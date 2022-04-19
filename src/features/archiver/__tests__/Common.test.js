import { Archiver } from "../Archiver";
import { SectionParser } from "../../../parser/SectionParser";
import { DateTreeResolver } from "../DateTreeResolver";
import { BlockParser } from "../../../parser/BlockParser";
import { EditorFile } from "../../../ActiveFile";
import { TaskListSorter } from "../../TaskListSorter";
import { ListToHeadingTransformer } from "../../ListToHeadingTransformer";

export const DEFAULT_SETTINGS = {
    archiveHeading: "Archived",
    archiveHeadingDepth: 1,
    weeklyNoteFormat: "YYYY-MM-[W]-w",
    useWeeks: false,
    dailyNoteFormat: "YYYY-MM-DD",
    useDays: false,
    addNewlinesAroundHeadings: true,
    indentationSettings: {
        useTab: true,
        tabSize: 4,
    },
    archiveToSeparateFile: false,
    defaultArchiveFileName: "<filename> (archive)",
};

export class MockVault {
    constructor(vaultState, archiveFile) {
        this.vaultState = vaultState;
        this.archiveFile = archiveFile;
    }

    read(file) {
        return this.vaultState.get(file).join("\n");
    }

    modify(file, contents) {
        this.vaultState.set(file, contents.split("\n"));
    }

    getAbstractFileByPath() {
        return this.archiveFile;
    }
}

export class MockEditor {
    constructor(vaultState, activeFile, cursor = { line: 0, ch: 0 }) {
        this.activeFile = activeFile;
        this.vaultState = vaultState;
        this.cursor = cursor;
    }

    getValue() {
        return this.vaultState.get(this.activeFile).join("\n");
    }

    setValue(value) {
        this.vaultState.set(this.activeFile, value.split("\n"));
    }

    getCursor() {
        return this.cursor;
    }

    getLine(n) {
        return this.vaultState.get(this.activeFile)[n];
    }

    lastLine() {
        return this.vaultState.get(this.activeFile).length - 1;
    }

    getRange(from, to) {
        return this.vaultState
            .get(this.activeFile)
            .slice(from.line, to.line + 1)
            .join("\n");
    }

    replaceRange(replacement, from, to) {
        this.vaultState
            .get(this.activeFile)
            .splice(from.line, to.line - from.line + 1, ...replacement.split("\n"));
    }
}

export class TestHarness {
    constructor(activeFileState, settings) {
        // todo: store file state in the file itself
        this.activeFile = buildMarkdownTFile(activeFileState);
        this.archiveFile = buildMarkdownTFile([""]);
        this.vaultState = new Map([
            [this.activeFile, activeFileState],
            [this.archiveFile, [""]],
        ]);
        this.mockWorkspace = {
            getActiveFile: () => this.activeFile,
        };
        this.editor = new MockEditor(this.vaultState, this.activeFile);
        this.editorFile = new EditorFile(this.editor);
        this.settings = settings;
    }

    buildArchiver() {
        return new Archiver(
            new MockVault(this.vaultState, this.archiveFile),
            this.mockWorkspace,
            new SectionParser(new BlockParser(this.settings.indentationSettings)),
            new DateTreeResolver(this.settings),
            this.settings
        );
    }

    buildSorter() {
        // todo
    }

    buildListToHeadingTransformer() {
        // todo
    }

    expectActiveFileStateToEqual(expected) {
        expect(this.vaultState.get(this.activeFile)).toEqual(expected);
    }

    expectArchiveFileStateToEqual(expected) {
        expect(this.vaultState.get(this.archiveFile)).toEqual(expected);
    }
}

export function buildMarkdownTFile(fileState) {
    // This is needed to pass `instanceof` checks
    const TFile = jest.requireMock("obsidian").TFile;
    const file = Object.create(TFile.prototype);
    file.state = fileState;

    file.extension = "md";
    return file;
}

// todo: delete
function setUpVaultState(input) {
    vaultState.set(activeFile, input);
    vaultState.set(archiveFile, [""]);
}

// todo: delete
const vaultState = new Map();
const activeFile = buildMarkdownTFile();
const archiveFile = buildMarkdownTFile();

// todo: delete
beforeEach(() => {
    vaultState.clear();
});

function sortListUnderCursorAndCheckActiveFile(
    input,
    expectedOutput,
    settings = DEFAULT_SETTINGS
) {
    const taskListSorter = buildTaskListSorter(input, settings);

    taskListSorter.sortListUnderCursor(new MockEditor(vaultState, activeFile));

    expect(vaultState.get(activeFile)).toEqual(expectedOutput);
}

function buildTaskListSorter(input, settings) {
    vaultState.set(activeFile, input);

    return new TaskListSorter(
        new SectionParser(new BlockParser(settings.indentationSettings)),
        settings
    );
}

describe("Sort tasks in list under cursor recursively", () => {
    test("No list under cursor", () => {
        sortListUnderCursorAndCheckActiveFile(["text"], ["text"]);
    });

    test("One level of sorting, mixed entries", () => {
        sortListUnderCursorAndCheckActiveFile(
            [
                "- [x] completed 1",
                "- text 1",
                "- [ ] incomplete 1",
                "- text 2",
                "- [x] completed 2",
                "- text 3",
            ],
            [
                "- text 1",
                "- text 2",
                "- text 3",
                "- [ ] incomplete 1",
                "- [x] completed 1",
                "- [x] completed 2",
            ]
        );
    });

    test("Multiple levels of nesting", () => {
        sortListUnderCursorAndCheckActiveFile(
            [
                "- [x] completed",
                "\t- [x] completed",
                "\t- [ ] incomplete",
                "\t- text 1",
                "- [ ] incomplete",
                "\t- text",
                "\t\t- [x] completed",
                "\t\t- text",
            ],
            [
                "- [ ] incomplete",
                "\t- text",
                "\t\t- text",
                "\t\t- [x] completed",
                "- [x] completed",
                "\t- text 1",
                "\t- [ ] incomplete",
                "\t- [x] completed",
            ]
        );
    });

    test("Text under list item", () => {
        sortListUnderCursorAndCheckActiveFile(
            [
                "- [ ] incomplete",
                "  text under list item",
                "  text under list item 2",
                "- text",
                "\t- text",
                "\t\t- [x] completed",
                "\t\t  text under list item",
                "\t\t  text under list item 2",
                "\t\t- text",
            ],
            [
                "- text",
                "\t- text",
                "\t\t- text",
                "\t\t- [x] completed",
                "\t\t  text under list item",
                "\t\t  text under list item 2",
                "- [ ] incomplete",
                "  text under list item",
                "  text under list item 2",
            ]
        );
    });
});

function buildListToHeadingTransformer(input, settings = DEFAULT_SETTINGS) {
    // TODO: this is out of place
    vaultState.set(activeFile, input);

    return new ListToHeadingTransformer(
        new SectionParser(new BlockParser(settings.indentationSettings)),
        settings
    );
}

describe("Turn list items into headings", () => {
    test("No list under cursor", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["text"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["text"]);
    });

    test("Single list line", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["- li"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("One level of nesting, cursor at line 0", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li",
            "\t- li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", "", "- li 2", ""]);
    });

    test("One level of nesting, cursor at nested list line", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li",
            "\t- li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile, { line: 1, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", "", "## li 2", ""]);
    });

    test("Multiple levels of nesting, cursor in mid depth", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li 1",
            "\t- li 2",
            "\t\t- li 3",
            "\t\t\t\t- li 4",
            "\t\t\t\t\t- li 6",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile, { line: 2, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual([
            "# li 1",
            "",
            "## li 2",
            "",
            "### li 3",
            "",
            "- li 4",
            "\t- li 6",
            "",
        ]);
    });

    test("Heading above list determines starting depth", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "# h 1",
            "",
            "- li 1",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile, { line: 2, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual(["# h 1", "", "## li 1", ""]);
    });

    test("Text after list item", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li 1",
            "  Text content 1",
            "  Text content 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual([
            "# li 1",
            "",
            "Text content 1",
            "Text content 2",
            "",
        ]);
    });

    test("Text after deeply nested list item", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li 1",
            "\t- li 2",
            "\t\t- li 3",
            "\t\t\t- li 4",
            "\t\t\t  Text content 1",
            "\t\t\t  Text content 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile, { line: 3, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual([
            "# li 1",
            "",
            "## li 2",
            "",
            "### li 3",
            "",
            "#### li 4",
            "",
            "Text content 1",
            "Text content 2",
            "",
        ]);
    });

    test("Respects newline settings", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(
            ["- li 1", "\t- li 2", "\t\t- li 3"],
            {
                ...DEFAULT_SETTINGS,
                addNewlinesAroundHeadings: false,
            }
        );

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li 1", "- li 2", "\t- li 3"]);
    });

    test("Respects indentation settings", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(
            ["- li 1", "    - li 2", "        - li 3"],
            {
                ...DEFAULT_SETTINGS,
                indentationSettings: {
                    useTab: false,
                    tabSize: 4,
                },
            }
        );

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile, { line: 2, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual([
            "# li 1",
            "",
            "## li 2",
            "",
            "### li 3",
            "",
        ]);
    });

    test("Tasks in list", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["- [x] li"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("Numbered lists", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["11. li"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("Different list tokens", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "* li",
            "\t+ li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, activeFile)
        );

        expect(vaultState.get(activeFile)).toEqual(["# li", "", "+ li 2", ""]);
    });
});
