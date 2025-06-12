# GitHub Workflows

## release.yml
Builds and releases the plugin when a tag is pushed. It installs dependencies, runs tests, bundles the plugin with Rollup, zips the distribution, and attaches assets to a GitHub release.

```mermaid
flowchart TD
  A[Tag Push] --> B[Install & Test]
  B --> C[Bundle]
  C --> D[Zip Assets]
  D --> E[Create GitHub Release]
```
