import { parseYaml } from "obsidian";

/**
 * Parse front matter lines into an object.
 * @param lines - Array of lines including opening and closing delimiters.
 */
export function parse_front_matter(lines: string[]): Record<string, unknown> {
  if (lines.length === 0) {
    return {};
  }

  const yaml = lines.slice(1, -1).join("\n");
  try {
    const data = parseYaml(yaml);
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Convert a front matter object to metadata string in dataview format.
 * @param front_matter - Parsed front matter object.
 */
export function front_matter_to_meta(front_matter: Record<string, unknown>): string {
  return Object.entries(front_matter)
    .map(([key, value]) => `${key}:: ${value}`)
    .join(" ");
}

/**
 * Pick specific keys from front matter.
 * @param front_matter - Parsed front matter object.
 * @param keys - Comma separated list of keys to pick. Use '*' for all or leave empty for none.
 */
export function pick_front_matter(
  front_matter: Record<string, unknown>,
  keys: string
): Record<string, unknown> {
  const trimmed = keys.trim();
  if (trimmed === "*") {
    return front_matter;
  }
  if (trimmed === "") {
    return {};
  }

  const allowed = trimmed
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k);

  return Object.fromEntries(
    Object.entries(front_matter).filter(([key]) => allowed.includes(key))
  );
}
