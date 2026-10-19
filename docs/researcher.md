# Researcher Study Creation: Static Frontend

Owner: Engineer 1 / Louis. Stage: Week 1, frontend only, without backend integration.

## 1. Goal and Scope

Researchers can configure a study, add Instructions, Video, and Survey blocks, edit their content, reorder them, and preview local files.

Cloud saving, uploads, synchronization, study execution, data export, audio recording, and camera access are not available. Save buttons are disabled, and the page explicitly states that the backend is not connected. Refreshing clears the current content. The previous simulated save service and simulated failure controls have been removed.

## 2. Page and Features

Route: `/researcher/studies/new`. The layout follows the design: study settings above the block list, English interface text, white and gray surfaces, and BU-red accents.

- Settings: study name; no, full, or videos-only randomization; video progress bar; response buttons; back navigation; and pause.
- Response buttons: thumbs-down on the left and thumbs-up on the right by default. Researchers can customize labels or select local icons. Disabling the buttons preserves their configuration.
- Instructions: plain-text input.
- Video: select, replace, play, and remove local videos, with validation messages for invalid files.
- Survey: edit the question and options, keeping at least two options.
- Reordering and deletion: stable block IDs; moving blocks preserves content; deletion requires confirmation.
- Required-field validation for names, instructions, questions, and options appears after leaving the corresponding field, without a simulated save.
- All edits exist only in the current page. Randomization settings do not execute the tablet study algorithm.

## 3. Frontend and Backend Collaboration

Engineer 1 owns the interface and local editing. Engineer 3 will implement APIs, authentication, storage, real uploads, and persistence. Engineer 2 owns the tablet runner and participates in confirming configuration semantics.

The existing `buildStudyPayload` adapter will accept backend-confirmed asset IDs. Integration must use real requests and upload/save states, without restoring simulated success behavior.

See the [Engineer 3 API Handoff](engineer3-handoff.md) for routes, fields, and upload sequencing. Randomization behavior, supported asset formats, and draft-saving rules still require team agreement.

## 4. Current CI

Checks cover implemented functionality only: ESLint → three real browser tests → production build. All three tests must pass; there is no coverage-percentage gate.

- [Three Real Browser Tests](researcher-tests.md)
- [CI, Local Commands, and Q2 Demo Guide](researcher-ci.md)

## 5. Running and Delivering

For full frontend development, run `npm run dev` and open http://localhost:3000/researcher/studies/new .

To start an isolated researcher preview:

```powershell
npm run researcher:preview
```

Open http://127.0.0.1:3102/researcher/studies/new .

Run automated checks:

```powershell
npx playwright install chromium
npm run researcher:ci
```

Deliverables include frontend code, three browser tests, CI configuration, and the API handoff. Use GitHub Issues for tasks and pull requests for reviews and results; no additional document-approval process is required.
