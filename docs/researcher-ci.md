# Researcher CI README

## Tools and Current Scope

The pipeline uses GitHub Actions, ESLint, Playwright, and Next.js. It verifies the researcher frontend (study builder, study list, saved-data and edit pages). It does not require a backend, Docker, or Supabase credentials, and does not deploy the application.

Workflow: [researcher-ci.yml](../.github/workflows/researcher-ci.yml)

## Implemented Tasks

```text
Relevant push / pull request
  → Install locked dependencies
  → 1. Run ESLint
  → Run unit tests (Jest)
  → Install Chromium
  → 2. Run four real browser tests
  → 3. Run the Next.js production build
  → Upload reports and write the run summary
```

- ESLint runs without `--fix`. Errors or warnings fail the check.
- Unit tests cover the Supabase row mapping and CSV export. Four browser tests cover page settings, block editing, actual local video playback, and navigation to the study list. See [Researcher Frontend Tests](researcher-tests.md).
- The build runs only after previous steps succeed. It performs real compilation, type checking, and static page generation, without skipping lint.
- A failed check prevents subsequent verification/build steps from running. Reporting steps still run where possible to preserve diagnostic information.
- There are no simulated-save tests or coverage-percentage gates.

The Q2 requirement of at least two activities is met through **Code Linting** and **Build Automation**. Unit and browser tests provide additional verification.

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



