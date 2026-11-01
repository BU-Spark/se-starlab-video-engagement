# Researcher Frontend Tests

CI has no Supabase credentials, so the browser tests exercise the pages in their local-preview state. Playwright runs them in a real Chromium browser. They do not fake save results, network responses, video-loading events, or time.

Source: [researcher.e2e.ts](../tests/researcher/researcher.e2e.ts)

| No. | Area | Actual Actions and Pass Conditions |
| --- | --- | --- |
| 1 | Page and settings | Open the creation page; check its heading and Supabase-not-configured notice; confirm Save is disabled; enter a study name, select “By group” randomization, and toggle swipe back; select a real SVG file and verify successful image decoding; check that the mobile-width page has no horizontal overflow. |
| 2 | Block editing | Add instruction and survey blocks, check their default labels (`instruction1`, `survey1`), rename one, enter content, and move the survey up. Verify that order changes while content is preserved and boundary move buttons are disabled. Cancel deletion and confirm the block remains, then confirm deletion and verify it disappears. |
| 3 | Local video | Select a real text file and verify the file-type error. Select the valid WebM fixture, wait for browser loading, check the block label became the file name, play it, and verify that playback time advances. Pause and remove it, then reload and verify that the page returns to its initial empty state. |
| 4 | Navigation | Follow “List of studies” from the builder, check the list page explains that Supabase is not configured and Refresh is disabled, then return through “Create new”. |

The video fixture is a locally generated, one-second solid-color video. The icon is a simple SVG. Neither contains participant or private data. These are real input files; the browser performs actual playback and image decoding.

Run:

```powershell
npx playwright install chromium
npm run researcher:test
```

All four tests must pass on every run. There is no coverage-percentage gate.

Unit tests (`npm run researcher:unit`) cover the database mapping (`toStudyRows` / `fromStudyRows`, randomization groups, storage paths) and CSV export (escaping, row order, file names). Saving, editing, deleting and data pages against a real Supabase project are verified manually; see [supabase-alignment.md](supabase-alignment.md).

The HTML report is available at `playwright-report/researcher/index.html`. Screenshots and traces are retained on failure. See [Researcher CI](researcher-ci.md) for pipeline sequencing and the classroom demo.

