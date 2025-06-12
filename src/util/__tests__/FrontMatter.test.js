import {
  parse_front_matter,
  front_matter_to_meta,
  pick_front_matter,
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

test("picks specific keys from front matter", () => {
  const picked = pick_front_matter(
    { foo: "bar", baz: "qux" },
    "foo"
  );
  expect(picked).toEqual({ foo: "bar" });
});

test("returns all when keys empty", () => {
  const picked = pick_front_matter(
    { foo: "bar", baz: "qux" },
    ""
  );
  expect(picked).toEqual({});
});
