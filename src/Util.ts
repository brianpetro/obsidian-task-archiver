import { IndentationSettings } from "./archiver/IndentationSettings";
import { Block } from "./model/Block";
import { Section } from "./model/Section";
import { chain, isEmpty, last, partition } from "lodash";
import { TextBlock } from "./model/TextBlock";
import { Editor, EditorPosition } from "obsidian";
import escapeStringRegexp from "escape-string-regexp";

const HEADING_PATTERN = /^(#+)\s/;
const BULLET_SIGN = `(?:[-*+]|\\d+\\.)`;
const LIST_ITEM_PATTERN = new RegExp(`^[ \t]*${BULLET_SIGN}( |\t)`);
const STRING_WITH_SPACES_PATTERN = new RegExp(`^[ \t]+`);
const TASK_PATTERN = new RegExp(`^${BULLET_SIGN} \\[[x ]]`);
const COMPLETED_TASK_PATTERN = new RegExp(`^${BULLET_SIGN} \\[x]`);

export function buildIndentation(settings: IndentationSettings) {
    return settings.useTab ? "\t" : " ".repeat(settings.tabSize);
}

export function findBlockRecursively(
    blocksOrBlock: Block[] | Block,
    matcher: (node: Block) => boolean
): Block | null {
    if (blocksOrBlock instanceof Block) {
        if (matcher(blocksOrBlock)) {
            return blocksOrBlock;
        }
        return findBlockRecursivelyInCollection(blocksOrBlock.children, matcher);
    }
    return findBlockRecursivelyInCollection(blocksOrBlock, matcher);
}

function findBlockRecursivelyInCollection(
    blocks: Block[],
    matcher: (node: Block) => boolean
) {
    for (const block of blocks) {
        if (matcher(block)) {
            return block;
        }
        const found = findBlockRecursively(block, matcher);
        if (found !== null) {
            return found;
        }
    }
    return null;
}

export function isCompletedTask(line: string) {
    return COMPLETED_TASK_PATTERN.test(line);
}

function isTask(line: string) {
    return TASK_PATTERN.test(line);
}

export function sortBlocksRecursively(root: Block) {
    const [tasks, nonTasks] = partition(root.children, (b) => isTask(b.text));
    const [complete, incomplete] = partition(tasks, (b) => isCompletedTask(b.text));
    root.children = [...nonTasks, ...incomplete, ...complete];

    for (const child of root.children) {
        sortBlocksRecursively(child);
    }
}

export function addNewlinesToSection(section: Section) {
    let lastSection = section;
    const childrenLength = section.children.length;
    if (childrenLength > 0) {
        lastSection = last(section.children);
    }
    const blocksLength = lastSection.blockContent.children.length;
    if (blocksLength > 0) {
        const lastBlock = last(lastSection.blockContent.children);
        if (lastBlock.text.trim().length !== 0) {
            lastSection.blockContent.appendChild(new TextBlock(""));
        }
    }
}

export function detectHeadingUnderCursor(editor: Editor) {
    let thisHeadingStartLineNumber = null;
    let thisHeadingLevel = null;

    for (
        let lookingAtLineNumber = editor.getCursor().line;
        lookingAtLineNumber >= 0;
        lookingAtLineNumber--
    ) {
        const lookingAtLine = editor.getLine(lookingAtLineNumber);
        const headingMatch = lookingAtLine.match(HEADING_PATTERN);
        if (headingMatch) {
            thisHeadingStartLineNumber = lookingAtLineNumber;
            const [, headingToken] = headingMatch;
            thisHeadingLevel = headingToken.length;
            break;
        }
    }

    if (thisHeadingStartLineNumber === null) {
        return null;
    }

    const higherOrEqualHeadingPattern = new RegExp(`^#{1,${thisHeadingLevel}}\\s`);
    const lineBelowHeadingStart = thisHeadingStartLineNumber + 1;
    let thisHeadingLastLineNumber = thisHeadingStartLineNumber;

    for (
        let lookingAtLineNumber = lineBelowHeadingStart;
        lookingAtLineNumber <= editor.lastLine();
        lookingAtLineNumber++
    ) {
        const lookingAtLine = editor.getLine(lookingAtLineNumber);
        const isLineHigherOrEqualHeading =
            higherOrEqualHeadingPattern.test(lookingAtLine);
        if (isLineHigherOrEqualHeading) {
            break;
        }
        thisHeadingLastLineNumber = lookingAtLineNumber;
    }

    if (thisHeadingLastLineNumber === null) {
        return null;
    }

    const thisHeadingRange: [EditorPosition, EditorPosition] = [
        { line: thisHeadingStartLineNumber, ch: 0 },
        {
            line: thisHeadingLastLineNumber,
            ch: editor.getLine(thisHeadingLastLineNumber).length,
        },
    ];

    return thisHeadingRange;
}

export function detectListUnderCursor(editor: Editor) {
    let thisListStartLineNumber = null;

    for (
        let lookingAtLineNumber = editor.getCursor().line;
        lookingAtLineNumber >= 0;
        lookingAtLineNumber--
    ) {
        const lookingAtLine = editor.getLine(lookingAtLineNumber);
        if (!isListItem(lookingAtLine) && !isIndentedLine(lookingAtLine)) {
            break;
        }
        thisListStartLineNumber = lookingAtLineNumber;
    }

    if (thisListStartLineNumber === null) {
        return null;
    }

    const lineBelowListStart = thisListStartLineNumber + 1;
    let thisListLastLineNumber = thisListStartLineNumber;

    for (
        let lookingAtLineNumber = lineBelowListStart;
        lookingAtLineNumber <= editor.lastLine();
        lookingAtLineNumber++
    ) {
        const lookingAtLine = editor.getLine(lookingAtLineNumber);
        if (!isListItem(lookingAtLine) && !isIndentedLine(lookingAtLine)) {
            break;
        }
        thisListLastLineNumber = lookingAtLineNumber;
    }

    if (thisListLastLineNumber === null) {
        return null;
    }

    const thisListRange: [EditorPosition, EditorPosition] = [
        { line: thisListStartLineNumber, ch: 0 },
        {
            line: thisListLastLineNumber,
            ch: editor.getLine(thisListLastLineNumber).length,
        },
    ];
    return thisListRange;
}

function isListItem(line: string) {
    return LIST_ITEM_PATTERN.test(line);
}

function isIndentedLine(line: string) {
    return STRING_WITH_SPACES_PATTERN.test(line);
}

export function buildHeadingPattern(heading: string) {
    const escapedArchiveHeading = escapeStringRegexp(heading);
    return new RegExp(`\\s*${escapedArchiveHeading}$`);
}

export function normalizeNewlinesRecursively(root: Section) {
    for (const child of root.children) {
        child.blockContent.children = normalizeNewlines(child.blockContent.children);
        normalizeNewlinesRecursively(child);
    }
}

export function stripSurroundingNewlines(blocks: Block[]) {
    return chain(blocks).dropWhile(isEmptyBlock).dropRightWhile(isEmptyBlock).value();
}

function isEmptyBlock(block: Block) {
    return block.text.trim().length === 0;
}

export function addSurroundingNewlines(blocks: Block[]) {
    const empty = new TextBlock("");
    if (isEmpty(blocks)) {
        return [empty];
    }
    return [empty, ...blocks, empty];
}

function normalizeNewlines(blocks: Block[]) {
    return addSurroundingNewlines(stripSurroundingNewlines(blocks));
}
