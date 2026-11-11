# Insights tests

Pure-logic tests for Content History and Brand Analytics. They use Node's built-in test runner, so no dependency is added.

From `frontend/`:

```bash
npx esbuild tests/insights.test.ts --bundle --platform=node --format=esm --outfile=.tmp/insights.test.mjs --log-level=warning
node --test .tmp/insights.test.mjs
```

`esbuild` ships with Vite, which the project already depends on. Delete `.tmp/` afterwards (it is not part of the deliverable).
