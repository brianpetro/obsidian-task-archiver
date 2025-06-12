import {
  parse_front_matter,
  front_matter_to_meta,
} from "../FrontMatter";

test("parses yaml front matter", () => {
  const lines = ["---", "foo: bar", "baz: qux", "---"];
  const parsed = parse_front_matter(lines);
  expect(parsed).toEqual({ foo: "bar", baz: "qux" });
});

test("converts front matter to metadata", () => {
  const meta = front_matter_to_meta({ foo: "bar", baz: "qux" });
  expect(meta).toBe("foo:: bar baz:: qux");
});

