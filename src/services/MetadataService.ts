import { PlaceholderService } from "./PlaceholderService";

import { Settings } from "../Settings";
import { BlockWithRule } from "../types/Types";
import { front_matter_to_meta, pick_front_matter } from "../util/FrontMatter";

export class MetadataService {
  constructor(
    private readonly placeholderService: PlaceholderService,
    private readonly settings: Settings
  ) {}

  appendMetadata =
    (front_matter: Record<string, unknown>) =>
    ({ task, rule }: BlockWithRule) => {
      if (!this.settings.additionalMetadataBeforeArchiving.addMetadata) {
        return { task, rule };
      }

      const { metadata, dateFormat } = {
        ...this.settings.additionalMetadataBeforeArchiving,
        ...rule,
      };

      const resolved_metadata = this.placeholderService.resolve(metadata, {
        dateFormat,
        block: task,
        heading: task.parentSection.text,
      });

      const filtered = pick_front_matter(
        front_matter,
        this.settings.additionalMetadataBeforeArchiving.frontmatterKeys
      );
      const front_matter_metadata = front_matter_to_meta(filtered);
      const suffix = [resolved_metadata, front_matter_metadata]
        .filter((part) => part)
        .join(" ");

      task.text = `${task.text} ${suffix}`.trim();
      return { task, rule };
    };
}
