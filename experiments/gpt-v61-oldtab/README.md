# GPT independent pre-release regression — old v6 tab vs v6.1 (18 Oct 2026)

**Bounded research; no product modifications, no auto-deployment, no Owner data.**
From the exact pinned \`2fde987\` published v6 HTML and Opus v6.1 build at
\`d95dbe6\`, a throwaway Chromium context simulates this release boundary:

1. A loaded public v6 page writes a synthetic \`SYNTHETIC_OLD\` note.
2. A v6.1 page on the **same test origin** reads it, updates to \`SYNTHETIC_NEW\` and persists.
3. v6.1 leaves. Older v6 leaves last, triggering its own actual \`pagehide\`.
4. A new v6.1 page opens and the test records which note was durably preserved.

**Important contract:** a green *experimental* workflow means the test observed
the pinned version's **unsafe counterexample** (\`releaseGate=FAIL\`), **not**
that Jaskinia is safe to publish. If it stops reproducing, inspect whether
the runtime/release contract was deliberately changed or the test malfunctioned.

Only a small synthetic JSON observation is uploaded. It is not an accepted product,
a new release gate imposed on Opus, or a permanent compatibility architecture.
The distinct **material IndexedDB record** risk remains outside this test.

Run on a clean checkout of this exact experimental branch:

\`node experiments/gpt-v61-oldtab/run.mjs\`

Requires an installed Playwright Chromium (the workflow installs it). A local
static HTTP server serves both revisions on the same disposable localhost origin.
It **never** navigates to the actual \`jozzpoly.github.io\` storage origin.
Source discussion: https://github.com/Jozzpoly/Jozz-Cave-Workbench/pull/4#issuecomment-6253177404
