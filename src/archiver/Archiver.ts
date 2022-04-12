import { ArchiverSettings } from "./ArchiverSettings";
import { SectionParser } from "../parser/SectionParser";
import { Section } from "../model/Section";
import { Block } from "../model/Block";
import { Editor, TFile, Vault, Workspace } from "obsidian";
import { DateTreeResolver } from "./DateTreeResolver";
import { RootBlock } from "../model/RootBlock";
import {
    addNewlinesToSection,
    buildHeadingPattern,
    buildIndentation,
    detectHeadingUnderCursor,
    detectListUnderCursor,
    isCompletedTask,
    normalizeNewlinesRecursively,
} from "../Util";
import { ActiveFile, DiskFile, EditorFile } from "./ActiveFile";
import { isEmpty } from "lodash";
import { BlockParser } from "../parser/BlockParser";

type TreeEditorCallback = (tree: Section) => void;

export class Archiver {
    private static readonly ACTIVE_FILE_PLACEHOLDER = "%";

    constructor(
        private readonly vault: Vault,
        private readonly workspace: Workspace,
        private readonly parser: SectionParser,
        private readonly dateTreeResolver: DateTreeResolver,
        private readonly settings: ArchiverSettings,
        private readonly archiveHeadingPattern: RegExp = buildHeadingPattern(
            settings.archiveHeading
        )
    ) {}

    async archiveTasksInActiveFile(file: ActiveFile) {
        const tasks = await this.extractTasksFromActiveFile(file);
        const archiveFile = await this.getArchiveFile(file);

        await this.editFileTree(archiveFile, (tree: Section) =>
            this.archiveBlocksToRoot(tasks, tree)
        );

        return isEmpty(tasks)
            ? "No tasks to archive"
            : `Archived ${tasks.length} tasks`;
    }

    async deleteTasksInActiveFile(file: ActiveFile) {
        const tasks = await this.extractTasksFromActiveFile(file);
        return isEmpty(tasks) ? "No tasks to delete" : `Deleted ${tasks.length} tasks`;
    }

    async archiveHeadingUnderCursor(editor: Editor) {
        // TODO: out of place
        const thisHeadingRange = detectHeadingUnderCursor(editor);
        if (thisHeadingRange === null) {
            return;
        }

        const thisHeadingLines = editor.getRange(...thisHeadingRange).split("\n");

        editor.replaceRange("", ...thisHeadingRange);

        const parsedHeadingRoot = this.parser.parse(thisHeadingLines);
        const parsedHeading = parsedHeadingRoot.children[0];
        const activeFile = new EditorFile(editor);

        await this.archiveSection(activeFile, parsedHeading);
    }

    async archiveSection(activeFile: ActiveFile, section: Section) {
        const archiveFile = await this.getArchiveFile(activeFile);

        await this.editFileTree(archiveFile, (tree) => {
            const archiveSection = this.getArchiveSectionFromRoot(tree);
            const archiveHeadingLevel = archiveSection.tokenLevel;
            section.recalculateTokenLevels(archiveHeadingLevel + 1);
            archiveSection.appendChild(section);
        });
    }

    turnListItemsIntoHeadings(editor: Editor) {
        const thisListRange = detectListUnderCursor(editor);
        if (thisListRange === null) {
            return;
        }

        const thisListLines = editor.getRange(...thisListRange).split("\n");

        const parsedRoot = this.parser.parse(thisListLines);
        const newSectionRoot = Archiver.buildSectionFromList(parsedRoot.blockContent);
        Archiver.replaceChildBlocksWithChildSectionsRecursively(
            newSectionRoot,
            this.getDepthOfLineUnderCursor(editor)
        );

        const newHeadingDepth = this.getHeadingLevelUnderCursor(editor);
        newSectionRoot.recalculateTokenLevels(newHeadingDepth);

        if (this.settings.addNewlinesAroundHeadings) {
            normalizeNewlinesRecursively(newSectionRoot);
        }

        const newListLines = newSectionRoot
            .stringify(buildIndentation(this.settings.indentationSettings))
            .join("\n");

        editor.replaceRange(newListLines, ...thisListRange);
    }

    private getDepthOfLineUnderCursor(editor: Editor) {
        const line = editor.getLine(editor.getCursor().line);
        // TODO: kludge. This is not a good reason to create a parser
        return new BlockParser(this.settings.indentationSettings).getIndentationLevel(
            line
        );
    }

    private static buildSectionFromList(listRoot: Block) {
        const newBlockContent = new RootBlock();
        newBlockContent.children = listRoot.children;
        // TODO: this regex is out of place
        const sectionText = listRoot.text.replace(
            /^(?<bullet>[-*+]|\d+\.)(?<task> \[[x ]])?/,
            ""
        );
        // TODO: root has level 0, this is implicit
        return new Section(sectionText, 0, newBlockContent);
    }

    private static replaceChildBlocksWithChildSectionsRecursively(
        section: Section,
        maxReplacementDepth: number,
        currentDepth: number = 1 // TODO: again, implicit knowledge about levels
    ) {
        if (currentDepth > maxReplacementDepth) {
            return;
        }
        for (const blockChild of section.blockContent.children) {
            section.appendChild(Archiver.buildSectionFromList(blockChild));
        }
        section.blockContent.children = [];

        for (const child of section.children) {
            Archiver.replaceChildBlocksWithChildSectionsRecursively(
                child,
                maxReplacementDepth,
                currentDepth + 1
            );
        }
    }

    private getHeadingLevelUnderCursor(editor: Editor) {
        const headingUnderCursor = detectHeadingUnderCursor(editor);
        if (headingUnderCursor === null) {
            return 0;
        }
        const emptyRootSectionUnderCursor = this.parser.parse(
            editor.getRange(...headingUnderCursor).split("\n")
        );
        const actualSectionUnderCursor = emptyRootSectionUnderCursor.children[0];
        return actualSectionUnderCursor.tokenLevel;
    }

    private async getArchiveFile(activeFile: ActiveFile) {
        return this.settings.archiveToSeparateFile
            ? new DiskFile(await this.getOrCreateArchiveFile(), this.vault)
            : activeFile;
    }

    private async editFileTree(file: ActiveFile, cb: TreeEditorCallback) {
        const tree = this.parser.parse(await file.readLines());
        cb(tree);
        await file.writeLines(this.stringifyTree(tree));
    }

    private async extractTasksFromActiveFile(file: ActiveFile) {
        let tasks: Block[] = [];
        await this.editFileTree(file, (tree) => {
            tasks = this.extractTasksFromTreeSkippingArchive(tree);
        });
        return tasks;
    }

    private archiveBlocksToRoot(tasks: Block[], root: Section) {
        const archiveSection = this.getArchiveSectionFromRoot(root);
        this.dateTreeResolver.mergeNewBlocksWithDateTree(
            archiveSection.blockContent,
            tasks
        );
    }

    private getArchiveSectionFromRoot(section: Section) {
        let archiveSection = section.children.find((s) =>
            this.archiveHeadingPattern.test(s.text)
        );
        if (!archiveSection) {
            if (this.settings.addNewlinesAroundHeadings) {
                addNewlinesToSection(section);
            }
            archiveSection = this.buildArchiveSection();
            section.appendChild(archiveSection);
        }
        return archiveSection;
    }

    private buildArchiveSection() {
        return new Section(
            ` ${this.settings.archiveHeading}`,
            this.settings.archiveHeadingDepth,
            new RootBlock()
        );
    }

    private extractTasksFromTreeSkippingArchive(tree: Section) {
        return tree.extractBlocksRecursively({
            blockFilter: (block: Block) => isCompletedTask(block.text),
            sectionFilter: (section: Section) => !this.isArchive(section.text),
        });
    }

    private isArchive(line: string) {
        return this.archiveHeadingPattern.test(line);
    }

    private async getOrCreateArchiveFile() {
        const archiveFileName = this.buildArchiveFileName();
        return await this.getOrCreateFile(archiveFileName);
    }

    private buildArchiveFileName() {
        const activeFileBaseName = this.workspace.getActiveFile().basename;
        const archiveFileBaseName = this.settings.defaultArchiveFileName.replace(
            Archiver.ACTIVE_FILE_PLACEHOLDER,
            activeFileBaseName
        );
        return `${archiveFileBaseName}.md`;
    }

    private async getOrCreateFile(name: string) {
        const file =
            this.vault.getAbstractFileByPath(name) ||
            (await this.vault.create(name, ""));

        if (!(file instanceof TFile)) {
            throw new Error(`${name} is not a valid markdown file`);
        }

        return file;
    }

    private stringifyTree(tree: Section) {
        const indentation = buildIndentation(this.settings.indentationSettings);
        return tree.stringify(indentation);
    }
}

