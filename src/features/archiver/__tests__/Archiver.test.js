import moment from "moment";
import { Archiver } from "../Archiver";
import { SectionParser } from "../../../parser/SectionParser";
import { DateTreeResolver } from "../DateTreeResolver";
import { BlockParser } from "../../../parser/BlockParser";
import { EditorFile } from "../../../ActiveFile";
import { TaskListSorter } from "../../TaskListSorter";
import { ListToHeadingTransformer } from "../../ListToHeadingTransformer";

window.moment = moment;
const WEEK = "2021-01-W-1";
const DAY = "2021-01-01";
Date.now = () => new Date(DAY).getTime();

jest.mock("obsidian");

const DEFAULT_SETTINGS = {
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

const vaultState = new Map();
const activeFile = buildMarkdownTFile();
const archiveFile = buildMarkdownTFile();

class MockVault {
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

class MockEditor {
    constructor(vaultState, cursor = { line: 0, ch: 0 }) {
        this.vaultState = vaultState;
        this.cursor = cursor;
    }

    getValue() {
        return this.vaultState.get(activeFile).join("\n");
    }

    setValue(value) {
        this.vaultState.set(activeFile, value.split("\n"));
    }

    getCursor() {
        return this.cursor;
    }

    getLine(n) {
        return this.vaultState.get(activeFile)[n];
    }

    lastLine() {
        return this.vaultState.get(activeFile).length - 1;
    }

    getRange(from, to) {
        return this.vaultState
            .get(activeFile)
            .slice(from.line, to.line + 1)
            .join("\n");
    }

    replaceRange(replacement, from, to) {
        this.vaultState
            .get(activeFile)
            .splice(from.line, to.line - from.line + 1, ...replacement.split("\n"));
    }
}

beforeEach(() => {
    vaultState.clear();
});

function buildMarkdownTFile() {
    // This is needed to pass `instanceof` checks
    const TFile = jest.requireMock("obsidian").TFile;
    const file = Object.create(TFile.prototype);

    file.extension = "md";
    return file;
}

async function archiveTasksAndCheckActiveFile(
    input,
    expectedOutput,
    settings = DEFAULT_SETTINGS
) {
    await archiveCompletedTasks(input, settings);
    expect(vaultState.get(activeFile)).toEqual(expectedOutput);
}

async function archiveCompletedTasks(input, settings = DEFAULT_SETTINGS) {
    setUpVaultState(input);
    const archiver = buildArchiver(input, settings);
    return await archiver.archiveTasksInActiveFile(
        new EditorFile(new MockEditor(vaultState))
    );
}

function buildArchiver(input, settings = DEFAULT_SETTINGS) {
    // TODO: this is out of place
    const workspace = {
        getActiveFile: () => activeFile,
    };

    return new Archiver(
        new MockVault(vaultState, archiveFile),
        workspace,
        new SectionParser(new BlockParser(settings.indentationSettings)),
        new DateTreeResolver(settings),
        settings
    );
}

function setUpVaultState(input) {
    vaultState.set(activeFile, input);
    vaultState.set(archiveFile, [""]);
}

async function deleteCompletedTasks(input, settings = DEFAULT_SETTINGS) {
    setUpVaultState(input);
    const archiver = buildArchiver(input, settings);
    return await archiver.deleteTasksInActiveFile(
        new EditorFile(new MockEditor(vaultState))
    );
}

function testFnAsyncArchiveTasksAndCheckActiveFile(
    input,
    expectedOutput,
    settings = DEFAULT_SETTINGS
) {
    return async () => {
        await archiveCompletedTasks(input, settings);
        expect(vaultState.get(activeFile)).toEqual(expectedOutput);
    };
}

describe("Moving top-level tasks to the archive", () => {
    test(
        "Only normalizes whitespace when there are no completed tasks",
        testFnAsyncArchiveTasksAndCheckActiveFile(
            ["foo", "bar", "# Archived"],
            ["foo", "bar", "# Archived", ""]
        )
    );

    test("Moves a single task to an empty archive", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [x] foo", "- [ ] bar", "# Archived"],
            ["- [ ] bar", "# Archived", "", "- [x] foo", ""]
        );
    });

    test("Moves a single task to an h2 archive", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [x] foo", "- [ ] bar", "## Archived"],
            ["- [ ] bar", "## Archived", "", "- [x] foo", ""]
        );
    });

    test("Handles multiple levels of indentation", async () => {
        await archiveTasksAndCheckActiveFile(
            [
                "- [x] root",
                "\t- child 1",
                "\t\t- child 2",
                "\t\t\t- child 3",
                "\t\t\t\t- [x] child with tasks 4",
                "# Archived",
            ],
            [
                "# Archived",
                "",
                "- [x] root",
                "\t- child 1",
                "\t\t- child 2",
                "\t\t\t- child 3",
                "\t\t\t\t- [x] child with tasks 4",
                "",
            ]
        );
    });

    test("Moves multiple tasks to the end of a populated archive", async () => {
        await archiveTasksAndCheckActiveFile(
            [
                "- [x] foo",
                "- [x] foo #2",
                "- [ ] bar",
                "- [x] foo #3",
                "# Archived",
                "",
                "- [x] Completed",
                "- [x] Completed #2",
                "",
            ],
            [
                "- [ ] bar",
                "# Archived",
                "",
                "- [x] Completed",
                "- [x] Completed #2",
                "- [x] foo",
                "- [x] foo #2",
                "- [x] foo #3",
                "",
            ]
        );
    });

    test.each([
        [["- [x] foo", "- [x] foo #2", "\t- [x] foo #3"], "Archived 2 tasks"],
        [["- [ ] foo"], "No tasks to archive"],
    ])(
        "Reports the number of top-level archived tasks: %s -> %s",
        async (input, expected) => {
            const message = await archiveCompletedTasks(input);
            expect(message).toBe(expected);
        }
    );

    test("Moves sub-items with top-level items after the archive heading, indented with tabs", async () => {
        await archiveTasksAndCheckActiveFile(
            [
                "- [ ] bar",
                "# Archived",
                "- [x] Completed",
                "# After archive",
                "Other stuff",
                "- [x] foo",
                "  stuff in the same block",
                "\t- Some info",
                "\t- [ ] A subtask",
            ],
            [
                "- [ ] bar",
                "# Archived",
                "",
                "- [x] Completed",
                "- [x] foo",
                "  stuff in the same block",
                "\t- Some info",
                "\t- [ ] A subtask",
                "",
                "# After archive",
                "Other stuff",
            ]
        );
    });

    test("Works only with top-level tasks", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [ ] bar", "\t- [x] completed sub-task", "- [x] foo", "# Archived"],
            [
                "- [ ] bar",
                "\t- [x] completed sub-task",
                "# Archived",
                "",
                "- [x] foo",
                "",
            ]
        );
    });

    test("Supports numbered tasks", async () => {
        await archiveTasksAndCheckActiveFile(
            ["1. [x] foo", "# Archived"],
            ["# Archived", "", "1. [x] foo", ""]
        );
    });

    test("Escapes regex characters in the archive heading value", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [x] foo", "- [ ] bar", "# [[Archived]]"],
            ["- [ ] bar", "# [[Archived]]", "", "- [x] foo", ""],
            {
                ...DEFAULT_SETTINGS,
                archiveHeading: "[[Archived]]",
            }
        );
    });

    describe("Creating a new archive", () => {
        test("Appends an archive heading to the end of file with a newline if there isn't any", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- Text", "1. [x] foo"],
                ["- Text", "", "# Archived", "", "1. [x] foo", ""]
            );
        });

        test("Doesn't add newlines around the archive heading if configured so", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo", "Some text"],
                ["Some text", "# Archived", "- [x] foo"],
                {
                    ...DEFAULT_SETTINGS,
                    addNewlinesAroundHeadings: false,
                }
            );
        });

        test("Pulls heading depth from the config", async () => {
            // TODO: this extra newline in the result is a bit clunky
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo"],
                ["", "### Archived", "", "- [x] foo", ""],
                {
                    ...DEFAULT_SETTINGS,
                    archiveHeadingDepth: 3,
                }
            );
        });
    });
});

describe("Deleting completed tasks", () => {
    test("Deletes completed tasks", async () => {
        const input = ["- [x] foo", "- [ ] bar"];

        await deleteCompletedTasks(input);

        expect(vaultState.get(activeFile)).toEqual(["- [ ] bar"]);
    });
});

describe("Separate files", () => {
    test("Creates a new archive in a separate file", async () => {
        const input = ["- [x] foo", "- [ ] bar"];

        await archiveCompletedTasks(input, {
            ...DEFAULT_SETTINGS,
            archiveToSeparateFile: true,
        });

        expect(vaultState.get(activeFile)).toEqual(["- [ ] bar"]);
        expect(vaultState.get(archiveFile)).toEqual([
            "",
            "# Archived",
            "",
            "- [x] foo",
            "",
        ]);
    });
});

describe("Date tree", () => {
    test("Archives tasks under a bullet with the current week", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [x] foo", "- [ ] bar", "# Archived"],
            ["- [ ] bar", "# Archived", "", `- [[${WEEK}]]`, "\t- [x] foo", ""],
            {
                ...DEFAULT_SETTINGS,
                useWeeks: true,
            }
        );
    });

    test("Uses indentation values from settings", async () => {
        await archiveTasksAndCheckActiveFile(
            ["- [x] foo", "# Archived"],
            ["# Archived", "", `- [[${WEEK}]]`, "   - [x] foo", ""],
            {
                ...DEFAULT_SETTINGS,
                useWeeks: true,
                indentationSettings: {
                    useTab: false,
                    tabSize: 3,
                },
            }
        );
    });

    test("Appends tasks under the current week bullet if it exists", async () => {
        await archiveTasksAndCheckActiveFile(
            [
                "- [x] foo",
                "# Archived",
                "- [[old week]]",
                "\t- [x] old task",
                `- [[${WEEK}]]`,
                "\t- [x] baz",
            ],
            [
                "# Archived",
                "",
                "- [[old week]]",
                "\t- [x] old task",
                `- [[${WEEK}]]`,
                "\t- [x] baz",
                "\t- [x] foo",
                "",
            ],
            {
                ...DEFAULT_SETTINGS,
                useWeeks: true,
            }
        );
    });

    describe("Days", () => {
        test("Archives tasks under a bullet with the current day", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo", "- [ ] bar", "# Archived"],
                ["- [ ] bar", "# Archived", "", `- [[${DAY}]]`, "\t- [x] foo", ""],
                {
                    ...DEFAULT_SETTINGS,
                    useDays: true,
                }
            );
        });
    });

    describe("Combining dates", () => {
        test("Creates & indents weekly & daily blocks", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo", "- [ ] bar", "# Archived"],
                [
                    "- [ ] bar",
                    "# Archived",
                    "",
                    `- [[${WEEK}]]`,
                    `\t- [[${DAY}]]`,
                    "\t\t- [x] foo",
                    "",
                ],
                {
                    ...DEFAULT_SETTINGS,
                    useDays: true,
                    useWeeks: true,
                }
            );
        });

        test("The week is already in the tree", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo", "- [ ] bar", "# Archived", "", `- [[${WEEK}]]`],
                [
                    "- [ ] bar",
                    "# Archived",
                    "",
                    `- [[${WEEK}]]`,
                    `\t- [[${DAY}]]`,
                    "\t\t- [x] foo",
                    "",
                ],
                {
                    ...DEFAULT_SETTINGS,
                    useDays: true,
                    useWeeks: true,
                }
            );
        });

        test("The week and the day are already in the tree", async () => {
            await archiveTasksAndCheckActiveFile(
                [
                    "- [x] foo",
                    "- [ ] bar",
                    "# Archived",
                    "",
                    `- [[${WEEK}]]`,
                    `\t- [[${DAY}]]`,
                ],
                [
                    "- [ ] bar",
                    "# Archived",
                    "",
                    `- [[${WEEK}]]`,
                    `\t- [[${DAY}]]`,
                    "\t\t- [x] foo",
                    "",
                ],
                {
                    ...DEFAULT_SETTINGS,
                    useDays: true,
                    useWeeks: true,
                }
            );
        });

        test("The day is there, but the week is not (the user has changed the configuration)", async () => {
            await archiveTasksAndCheckActiveFile(
                ["- [x] foo", "- [ ] bar", "# Archived", "", `- [[${DAY}]]`],
                [
                    "- [ ] bar",
                    "# Archived",
                    "",
                    `- [[${DAY}]]`,
                    `- [[${WEEK}]]`,
                    `\t- [[${DAY}]]`,
                    "\t\t- [x] foo",
                    "",
                ],
                {
                    ...DEFAULT_SETTINGS,
                    useDays: true,
                    useWeeks: true,
                }
            );
        });
    });
});

async function archiveHeadingAndCheckActiveFile(
    input,
    expectedOutput,
    settings = DEFAULT_SETTINGS
) {
    await archiveHeading(input, settings);

    expect(vaultState.get(activeFile)).toEqual(expectedOutput);
}

async function archiveHeading(input, settings) {
    setUpVaultState(input);
    const archiver = buildArchiver(input, settings);
    await archiver.archiveHeadingUnderCursor(new MockEditor(vaultState));
}

describe("Archive heading under cursor", () => {
    test("Base case", async () => {
        await archiveHeadingAndCheckActiveFile(
            ["# h1", "", "# Archived", ""],
            ["", "# Archived", "", "## h1", ""]
        );
    });

    test("Single line heading", async () => {
        await archiveHeadingAndCheckActiveFile(
            ["# h1", "# Archived", ""],
            ["", "# Archived", "", "## h1"]
        );
    });

    test("Nested heading", async () => {
        const lines = ["# h1", "## h2", "text", "# Archived", ""];
        setUpVaultState(lines);

        const archiver = buildArchiver(lines, DEFAULT_SETTINGS);

        await archiver.archiveHeadingUnderCursor(
            new MockEditor(vaultState, { line: 2, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual([
            "# h1",
            "",
            "# Archived",
            "",
            "## h2",
            "text",
        ]);
    });

    test("No heading under cursor", async () => {
        await archiveHeadingAndCheckActiveFile(["text"], ["text"]);
    });

    test("Moves to separate file", async () => {
        await archiveHeading(["# h1", "# Archived", ""], {
            ...DEFAULT_SETTINGS,
            archiveToSeparateFile: true,
        });

        // TODO: whitespace inconsistency
        expect(vaultState.get(archiveFile)).toEqual(["", "# Archived", "## h1"]);
    });
});

function sortListUnderCursorAndCheckActiveFile(
    input,
    expectedOutput,
    settings = DEFAULT_SETTINGS
) {
    const taskListSorter = buildTaskListSorter(input, settings);

    taskListSorter.sortListUnderCursor(new MockEditor(vaultState));

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

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["text"]);
    });

    test("Single list line", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["- li"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("One level of nesting, cursor at line 0", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li",
            "\t- li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["# li", "", "- li 2", ""]);
    });

    test("One level of nesting, cursor at nested list line", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li",
            "\t- li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(
            new MockEditor(vaultState, { line: 1, ch: 0 })
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
            new MockEditor(vaultState, { line: 2, ch: 0 })
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
            new MockEditor(vaultState, { line: 2, ch: 0 })
        );

        expect(vaultState.get(activeFile)).toEqual(["# h 1", "", "## li 1", ""]);
    });

    test("Text after list item", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "- li 1",
            "  Text content 1",
            "  Text content 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

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
            new MockEditor(vaultState, { line: 3, ch: 0 })
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

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

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
            new MockEditor(vaultState, { line: 2, ch: 0 })
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

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("Numbered lists", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer(["11. li"]);

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["# li", ""]);
    });

    test("Different list tokens", () => {
        const listToHeadingTransformer = buildListToHeadingTransformer([
            "* li",
            "\t+ li 2",
        ]);

        listToHeadingTransformer.turnListItemsIntoHeadings(new MockEditor(vaultState));

        expect(vaultState.get(activeFile)).toEqual(["# li", "", "+ li 2", ""]);
    });
});
