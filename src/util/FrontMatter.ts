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
