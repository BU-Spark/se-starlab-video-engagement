# Researcher CI README

## Tools and Current Scope

The pipeline uses GitHub Actions, ESLint, Playwright, and Next.js. It verifies only the Week 1 researcher static frontend. It does not require a backend, Docker, or Supabase, and does not deploy the application.

Workflow: [researcher-ci.yml](../.github/workflows/researcher-ci.yml)

## Implemented Tasks

```text
Relevant push / pull request
  → Install locked dependencies
  → 1. Run ESLint
  → Install Chromium
  → 2. Run three real browser tests
  → 3. Run the Next.js production build
  → Upload reports and write the run summary
```

- ESLint runs without `--fix`. Errors or warnings fail the check.
- Three browser tests cover page settings, block editing, and actual local video playback. See [Three Real Tests](researcher-tests.md).
- The build runs only after previous steps succeed. It performs real compilation, type checking, and static page generation, without skipping lint.
- A failed check prevents subsequent verification/build steps from running. Reporting steps still run where possible to preserve diagnostic information.
- There are no simulated-save tests or coverage-percentage gates.

These are browser functional tests, not unit tests. The Q2 requirement of at least two activities is met through **Code Linting** and **Build Automation**. Browser tests provide additional verification of the implemented static frontend.

## How to Trigger the Pipeline

Push changes to researcher code, its tests, or relevant shared configuration, or include those changes in a pull request. This triggers Researcher CI automatically. The workflow uses path filters, not the names `Louis` or `Louis-frontend`. Backend-only changes do not trigger this workflow.

Manual dispatch is also configured. The workflow must exist on the default branch before GitHub makes its manual-run entry available. The original Node.js CI remains independent and may also run on relevant pull requests.

Initial local setup:

```powershell
npm ci
npx playwright install chromium
```

Run the local pipeline:

```powershell
npm run researcher:ci
```

Individual commands are `researcher:lint`, `researcher:test`, and `researcher:build`. Browser tests automatically start and stop a dedicated server on port 3101 by default; no manually opened page is required. Use `researcher:preview` for a separate manual preview on port 3102.

Documentation-only changes do not trigger this path-filtered workflow. To record a real run, use a relevant code/configuration push or an available manual-dispatch entry.

## Challenges and Solutions

- Shared root layout: copy the researcher route and required layout into an isolated workspace to avoid building other business pages or overwriting an existing preview.
- Windows cross-drive paths and Next.js source under `node_modules`: keep temporary source in a dedicated same-drive `.next` directory and reuse installed dependencies.
- JSDOM cannot demonstrate actual video playback: use Chromium with a real WebM file and verify that playback time advances.
- No backend integration yet: disable Save and display an explicit notice instead of showing simulated success.
- The root layout uses `next/font/google`: the first compilation requires network access to fetch fonts.

## Results and Reports

The Actions run summary shows lint, browser-test, and build outcomes. The `researcher-browser-report` artifact is retained for seven days and includes HTML and JUnit XML reports, plus screenshots and traces on failure. Browser-test logs show the individual pass/fail results.

Local success does not establish GitHub Actions success. Commit and push the workflow and supporting files, then verify an actual remote run before recording. Do not describe this pipeline as automatic deployment or backend verification.

## Q2: One-Minute Demo

Prepare a completed, genuine Researcher CI run before recording; dependency installation and compilation do not need to fit inside the recording. Keep the workflow file, run logs, and summary ready in browser tabs.

| Time | Show | Explain |
| --- | --- | --- |
| 0–8 seconds | Actions → Researcher CI; the run event, branch, and commit | A relevant push or pull request starts this workflow. |
| 8–18 seconds | Workflow steps or the expanded job | ESLint runs first, browser tests follow, and the build runs only after success. |
| 18–32 seconds | ESLint success and the browser-test log showing three passed tests | Checks cover settings, block editing, and real local video playback, without backend mocks. |
| 32–46 seconds | The production-build log and researcher route output | The actual researcher page compiles successfully; a failed earlier check would skip this build. |
| 46–60 seconds | Run summary and browser-report artifact | Explain the green results, scope, and diagnostic report. Linting and build automation satisfy the two required activities. |

Suggested English narration:

> This is our Researcher CI workflow in GitHub Actions, triggered by this frontend change. It first runs ESLint, then three Playwright tests in a real Chromium browser. These check page settings, block editing, and local video playback. The log shows all three passed. Only after successful checks does Next.js build the researcher page. Here is the successful build output and route. The summary shows all checks succeeded, and the report artifact provides detailed test results. This demonstrates code linting and build automation, with browser tests as an extra check. It validates our current static frontend, not backend saving or deployment.

If showing a failed run, use an existing genuine failure and explain the failed step and skipped build. A separate failure demonstration is optional under the supplied rubric.

## Q3: README Submission

This file covers the CI tool, implemented tasks, triggers, and challenges. After pushing it, submit the GitHub URL of this file as the README link. Submit the recording link separately for Q2.

