# Services

## MetadataService.appendMetadata(front_matter)
Returns a function that appends configured metadata to a task. Metadata may
include placeholders resolved from the task context and note front matter.

```mermaid
graph TD
  A[Task + Rule] --> B[appendMetadata(front_matter)]
  B --> C{Add?}
  C -->|yes| D[Resolve placeholders]
  D --> E[Task with metadata]
  C -->|no| F
```
