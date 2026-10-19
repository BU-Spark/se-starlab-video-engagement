# Week 1 Researcher Frontend: Three Real Tests

The current implementation is a static researcher frontend without a backend. Playwright runs these tests in a real Chromium browser. They do not fake save results, network responses, video-loading events, or time.

Source: [researcher.e2e.ts](../tests/researcher/researcher.e2e.ts)

| No. | Area | Actual Actions and Pass Conditions |
| --- | --- | --- |
| 1 | Page and settings | Open the creation page; check its heading and backend-not-connected notice; confirm Save is disabled; enter a study name, select randomization, and toggle back navigation; select a real SVG file and verify successful image decoding; check that the mobile-width page has no horizontal overflow. |
| 2 | Block editing | Add instruction and survey blocks, enter content, and move the survey up. Verify that order changes while content is preserved and boundary move buttons are disabled. Cancel deletion and confirm the block remains, then confirm deletion and verify it disappears. |
| 3 | Local video | Select a real text file and verify the file-type error. Select the valid WebM fixture, wait for browser loading, play it, and verify that playback time advances. Pause and remove it, then reload and verify that the page returns to its initial empty state. |

The video fixture is a locally generated, one-second solid-color video. The icon is a simple SVG. Neither contains participant or private data. These are real input files; the browser performs actual playback and image decoding.

Run:

```powershell
npx playwright install chromium
npm run researcher:test
```

All three tests must pass on every run. There is no longer an 80% coverage threshold. The previous 26 researcher Jest tests and simulated save service have been removed. Cloud saving, uploads, synchronization, backend routes, and databases are not tested at this stage.

The HTML report is available at `playwright-report/researcher/index.html`. Screenshots and traces are retained on failure. See [Researcher CI](researcher-ci.md) for pipeline sequencing and the classroom demo.

