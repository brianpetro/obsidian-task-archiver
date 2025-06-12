# Services

## MetadataService.appendMetadata(front_matter)
Returns a function that appends configured metadata and provided front matter
values to a task. Front matter can be filtered using `frontmatterKeys` setting.

```mermaid
graph TD
  A[Task + Rule] --> B[appendMetadata(front_matter)]
  B --> C{Add?}
  C -->|yes| D[Resolve placeholders]
  D --> E[Combine with front matter]
  E --> F[Task with metadata]
  C -->|no| F
```
