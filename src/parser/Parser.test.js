import { SectionParser } from "./SectionParser";
import { TextBlock } from "../model/TextBlock";
import { buildIndentation, findBlockRecursively } from "../util";
import { BlockParser } from "./BlockParser";

const DEFAULT_SETTINGS = {
    useTab: true,
    tabSize: 2,
};

const DEFAULT_INDENTATION = buildIndentation(DEFAULT_SETTINGS);

// TODO: replace all copypaste
function parse(lines, settings = DEFAULT_SETTINGS) {
    return new SectionParser(new BlockParser(settings)).parse(lines);
}

test("Builds a flat structure with non-hierarchical text", () => {
    const lines = [
        "text",
        "|table|",
        "|----|",
        "|row|",
        "|another row|",
        "**Bold**",
        "```",
        "code",
        "```",
        "    # Not a real heading #",
        "    - Not a real list",
        "---",
    ];

    const doc = parse(lines);
    expect(doc.blockContent.children.length).toBe(lines.length);
});

describe("Headings", () => {
    test("Text after a heading gets nested", () => {
        const lines = ["# H1", "line"];

        const root = parse(lines);

        expect(root.children.length).toBe(1);
        const h1 = root.children[0];
        expect(h1.blockContent.children.length).toBe(1);
    });

    test("A subheading creates another level of nesting", () => {
        const lines = ["# H1", "## H2", "line"];

        const doc = parse(lines);

        const h1 = doc.children[0];
        expect(h1.children.length).toBe(1);
        const h2 = h1.children[0];
        expect(h2.blockContent.children.length).toBe(1);
    });

    test("A same-level heading doesn't get nested", () => {
        const lines = ["# H1", "## H2", "## H2-2"];

        const doc = parse(lines);

        const h1 = doc.children[0];
        expect(h1.children.length).toBe(2);
    });

    test("A higher-level heading pops nesting", () => {
        const lines = ["# H1", "## H2", "# H1", "line"];

        const doc = parse(lines);

        expect(doc.children.length).toBe(2);
        const secondH1 = doc.children[1];
        expect(secondH1.blockContent.children.length).toBe(1);
    });

    test("Doesn't break when the user jumps over a level", () => {
        const lines = ["# H1", "#### H4", "Text", "## H2"];

        const doc = parse(lines);
        expect(doc.children.length).toBe(1);
        expect(doc.children[0].children.length).toBe(2);
    });
});

function assertParseResult(lines, result, settings = DEFAULT_SETTINGS) {
    const doc = parse(lines, settings);
    expect(doc.blockContent.children).toMatchObject(result);
}

describe("List items", () => {
    test("Indented text after a list item gets nested", () => {
        const lines = ["- l", "\ttext"];

        const doc = parse(lines);
        expect(doc.blockContent.children.length).toBe(1);
        const listItem = doc.blockContent.children[0];
        expect(listItem.children.length).toBe(1);
    });

    test("An indented list item creates another level of nesting", () => {
        const lines = ["- l", "\t- l2", "\t\ttext"];

        const doc = parse(lines);
        const listItem = doc.blockContent.children[0];
        const indentedListItem = listItem.children[0];
        expect(indentedListItem.children.length).toBe(1);
    });

    test("A same level list item doesn't get nested", () => {
        const lines = ["- l", "\t- l2", "\t- l2-2"];
        const doc = parse(lines);
        const listItem = doc.blockContent.children[0];
        expect(listItem.children.length).toBe(2);
    });

    test("A higher-level list item pops nesting", () => {
        const lines = ["- l", "\t- l2", "- l2-2"];
        const doc = parse(lines);
        expect(doc.blockContent.children.length).toBe(2);
    });

    test("Multiple list items on different levels with spaces", () => {
        const lines = [
            "- 1",
            "    - 1a",
            "        - 1a1",
            "            - 1a1a",
            "    - 1b",
        ];

        const doc = parse(lines, { useTab: false, tabSize: 4 });
        expect(doc.blockContent.children.length).toBe(1);
    });

    test("A top-level line breaks out of a list context", () => {
        assertParseResult(
            ["- l", "\t- l2", "line"],
            [
                {
                    text: "- l",
                    children: [
                        {
                            text: "- l2",
                        },
                    ],
                },
                {
                    text: "line",
                },
            ]
        );
    });

    test.each([
        [2, ["- l", "  - l2", "    text", "", "  Top-level text"]],
        [4, ["- l", "    - l2", "      text", "", "    Top-level text"]],
    ])("Indentation with spaces of different lengths: %d", (tabSize, lines) => {
        const doc = parse(lines, { useTab: false, tabSize: tabSize });

        expect(doc.blockContent.children.length).toBe(3);
        const listItem = doc.blockContent.children[0];
        expect(listItem.children.length).toBe(1);
    });

    test.each([
        ["*", ["* l", "\t* l2", "\t\ttext"]],
        ["Numbers", ["1. l", "\t11. l2", "\t\ttext"]],
        ["Mixed", ["1. l", "\t* l2", "\t\ttext"]],
    ])("Different types of list markers: %s", (message, lines) => {
        assertParseResult(lines, [
            {
                text: expect.stringContaining("l"),
                children: [
                    {
                        text: expect.stringContaining("l2"),
                        children: [
                            {
                                text: "text",
                            },
                        ],
                    },
                ],
            },
        ]);
    });

    test("Handles misaligned lists", () => {
        assertParseResult(
            ["- l", "  - text"],
            [
                {
                    text: "- l",
                    children: [
                        {
                            text: "- text",
                        },
                    ],
                },
            ]
        );
    });

    test("Handles indentation detection when tabs get mixed with spaces (the number of spaces matches the config)", () => {
        const lines = ["- 1", "\t- 1.1", "\t\t- 1.1.1", "    - 1.2"];

        const doc = parse(lines, { ...DEFAULT_SETTINGS, tabSize: 4 });

        expect(doc.blockContent.children).toMatchObject([
            {
                text: "- 1",
                children: [
                    {
                        text: "- 1.1",
                        children: [
                            {
                                text: "- 1.1.1",
                            },
                        ],
                    },
                    {
                        text: "- 1.2",
                    },
                ],
            },
        ]);
    });
});

describe("Mixing headings and lists", () => {
    test("One heading, one list", () => {
        const lines = ["# h", "- l", "line"];
        const doc = parse(lines);
        expect(doc.children.length).toBe(1);
        const h1 = doc.children[0];
        expect(h1.blockContent.children.length).toBe(2);
    });

    test("Multiple heading levels", () => {
        const lines = ["# h", "- l", "text", "## h2", "# h1"];
        const doc = parse(lines);
        expect(doc.children.length).toBe(2);
        const h1 = doc.children[0];
        expect(h1.children.length).toBe(1);
        expect(h1.blockContent.children.length).toBe(2);
    });

    test("Multiple list levels", () => {
        const lines = ["# h", "- l", "\t- l2", "# h1"];
        const doc = parse(lines);
        expect(doc.children.length).toBe(2);
        const h1 = doc.children[0];
        expect(h1.blockContent.children.length).toBe(1);
        const list = h1.blockContent.children[0];
        expect(list.children.length).toBe(1);
    });
});

describe("Stringification", () => {
    test.each([
        [["Line", "Another line"]],
        [["# H1", "text", "## H2", "text", "# H1-2", "text"]],
        [["- l", "  text", "    - l", "text"]],
        [
            [
                "# H1",
                "- l1",
                "  indented",
                "    - l2",
                "text",
                "## h2",
                "- l1",
                "    - l2",
            ],
        ],
    ])("Round-tripping respects indentation settings: %s", (lines) => {
        const settings = { useTab: false, tabSize: 4 };
        const parsed = parse(lines, settings);
        const stringified = parsed.stringify(buildIndentation(settings));
        expect(stringified).toEqual(lines);
    });
});

// TODO: move this out into the AST files
describe("Extraction", () => {
    test("Extract top-level block with a filter", () => {
        const lines = ["Text", "Extract me"];
        const extracted = [["Extract me"]];
        const theRest = ["Text"];

        const parsed = parse(lines);

        const actual = parsed
            .extractBlocksRecursively({
                blockFilter: (block) =>
                    block.text !== null && block.text === "Extract me",
            })
            .map((b) => b.stringify(DEFAULT_INDENTATION));
        expect(actual).toEqual(extracted);
        expect(parsed.stringify(DEFAULT_INDENTATION)).toEqual(theRest);
    });
});

describe("Insertion", () => {
    test("Append a block", () => {
        const lines = ["- list", "- text"];

        const parsed = parse(lines);
        parsed.blockContent.appendChild(new TextBlock("more text"));
        const stringified = parsed.stringify(DEFAULT_INDENTATION);
        expect(stringified).toEqual(["- list", "- text", "more text"]);
    });

    test("Append a block to the start", () => {
        const lines = ["- list", "- text"];

        const parsed = parse(lines);
        parsed.blockContent.prependChild(new TextBlock("more text"));
        const stringified = parsed.stringify(DEFAULT_INDENTATION);
        expect(stringified).toEqual(["more text", "- list", "- text"]);
    });

    test("Automatically adds indentation to a text block after a list item", () => {
        const lines = ["- list"];

        const parsed = parse(lines);
        parsed.blockContent.children[0].appendChild(new TextBlock("indented text"));
        expect(parsed.stringify(DEFAULT_INDENTATION)).toEqual([
            "- list",
            "  indented text",
        ]);
    });
});

// TODO: doesn't belong here
describe("Block search", () => {
    test("Find a block matching a matcher", () => {
        const lines = ["- list", "\t- text"];
        const parsed = parse(lines);

        const searchResult = findBlockRecursively(parsed.blockContent.children, (b) =>
            b.text.includes("text")
        );

        expect(searchResult.stringify(DEFAULT_INDENTATION)[0]).toBe("- text");
    });
});
