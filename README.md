This is a template for Spark! DS 519 projects. It has pre-configured eslint.config.mjs - ([`ESLint`](https://eslint.org/)) and .prettierrc - ([`Prettier`](https://prettier.io/)) to reflect industry standard development guidelines.

## Setting Up Your Developer Experience

To get the most out of ESLint and Prettier, It is recommended to make the changes to you IDE:

#### Add this code to your _.vscode/settings.json_

```json
{
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### Download these VSCode extensions:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Getting Started

This template uses Next.js. If you havent used Next before or need more information, take a look here:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result. Do not use Microsoft Edge 🤮

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Testing Your Application

This template comes pre-configured with a robust testing setup to help you ensure code quality and maintainability. We use [Jest](https://jestjs.io/) as the testing framework and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for testing React components.

<details>
  <summary><strong>Key Testing Features & Configuration</strong></summary>

#### Integrated Tools

- **Jest:** A delightful JavaScript Testing Framework with a focus on simplicity. It works out of the box for most Next.js projects.
- **React Testing Library (RTL):** Provides light-weight utility functions on top of `react-dom` and `react-dom/test-utils`, in a way that encourages better testing practices. Its primary guiding principle is: _"The more your tests resemble the way your software is used, the more confidence they can give you."_
- **`@testing-library/jest-dom`:** Custom Jest matchers to extend Jest with useful assertions for DOM states (e.g., `toBeInTheDocument()`, `toHaveClass()`).

#### Configuration Files

- **`jest.config.ts`:** The main configuration file for Jest. It defines how Jest discovers and runs your tests, what environment to use (e.g., `jsdom` for browser-like environment), and any transformations needed (e.g., using `ts-node` for TypeScript).
- **`jest.setup.ts`:** This file is run before each test suite. It's used for global test setup, such as importing `@testing-library/jest-dom` to make its matchers available in all tests, or for setting up global mocks (like the `window.matchMedia` mock included in this template).

#### Test File Location

- Tests are co-located with the components or modules they are testing. For example, tests for `MyComponent.tsx` would typically be in a file named `MyComponent.test.tsx` within the same directory. This makes it easy to find and manage tests alongside the code they cover. Our `jest.config.ts` is set up to discover these `*.test.tsx` (and `*.test.ts`) files.

</details>

<details>
  <summary><strong>Running Tests</strong></summary>

You can run your tests using the following npm scripts:

- **`npm test`**: Runs all tests once. This is also the command used by the automated pre-commit and pre-push hooks.
  ```bash
  npm test
  ```
- **`npm run test:watch`**: Runs tests in watch mode. Jest will re-run tests related to changed files, which is very useful during development.
  ```bash
  npm run test:watch
  ```
- **`npm run test:coverage`**: Runs all tests and generates a code coverage report. This helps you see what percentage of your codebase is covered by tests. The report will be generated in a `coverage/` directory.
  ```bash
  npm run test:coverage
  ```
  </details>

<details>
  <summary><strong>Automated Testing with Husky</strong></summary>

To maintain code quality and prevent regressions, this template uses [Husky](https://typicode.github.io/husky/) to manage Git hooks. The following hooks are configured:

- **`pre-commit`**: Before any commit is finalized, this hook runs:
  1.  `npx lint-staged`: Lints and formats staged files (`*.{js,jsx,ts,tsx}`) using ESLint and Prettier.
  2.  `npm test`: Runs the entire test suite.
      If either linting/formatting fails or any test fails, the commit will be aborted, allowing you to fix the issues before committing.

- **`pre-push`**: Before any push to a remote repository, this hook runs:
  1.  `npm test`: Runs the entire test suite.
      If any test fails, the push will be aborted.

This ensures that your codebase remains well-formatted, lint-free, and that all tests are passing before changes are shared or integrated.

</details>

<details>
  <summary><strong>Testing Philosophy</strong></summary>

- **Focus on User Behavior:** Write tests that verify the functionality of your components from a user's perspective. React Testing Library encourages this by providing utilities to query and interact with the DOM in a way similar to how a user would.
- **Unit & Integration Tests:** Aim for a healthy mix of unit tests (testing individual functions or components in isolation) and integration tests (testing how multiple components work together).
- **Confidence, Not Coverage Alone:** While code coverage is a useful metric, the primary goal of testing is to give you confidence that your application works as expected. Prioritize tests that cover critical user flows and complex logic.
- **Readable and Maintainable Tests:** Write clear, concise, and well-structured tests. Like your application code, test code should also be maintainable.
</details>

## Managing Environment Variables

Properly managing environment variables is crucial for security and for configuring your application differently across various environments (development, testing, production). Next.js has built-in support for environment variables.

- **Key File: `.env.local`**: Use this for your local development. It **must** be added to `.gitignore` to protect sensitive information like API keys.
- **Client-Side Variables**: To expose a variable to the browser, prefix it with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_ANALYTICS_ID`). These are accessible via `process.env.NEXT_PUBLIC_YOUR_VARIABLE`. **Never store secrets in `NEXT_PUBLIC_` variables.**
- **Server-Side Variables**: Variables without the `NEXT_PUBLIC_` prefix (e.g., `DATABASE_URL`) are only available server-side via `process.env.YOUR_VARIABLE`.
- **Best Practice: `.env.example`**: Create an `.env.example` file in your project root. This file should list all environment variables your application needs, with placeholder values. It **should be committed to version control** as a template for other developers.

For more comprehensive details, refer to the [official Next.js documentation on environment variables](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables).

## Adding Additional Tech

Most projects will require the use of other technologies. Below are a few guides and recommedations for integrating commonly used software into your Next.js project.

- [Next.js Setup w/ Prisma](https://www.dhiwise.com/post/the-ultimate-guide-to-next-js-prisma-setup)
- [Emotion & Next.js](https://www.dhiwise.com/post/implementing-nextjs-emotions-in-your-project) - Emotion is the default CSS-in JS library for all new Spark! projects. Use Emotion instead of styled-components, as styled-components is not as easily compatible with Server Side Rendering, or Typed CSS variables. Emotion is also more readily compatible with a wide array of component libraries.
- [Clerk Setup w/ Next.js](https://clerk.com/docs/quickstarts/nextjs) - Clerk will be the default user authentication software for all new Spark! projects. Please reach out to Omar for creating and retrieving API keys for your project. Do NOT use firebase/auth even if your project uses Firestore.
- ### Component Libraries
  All new projects will be required to use a [design system](https://www.figma.com/blog/design-systems-101-what-is-a-design-system/) You will receive designs from your DS488 design team which will utilize a design kit. Use the corresponding component library to implement those designs on the front end of your project.

## Participant Tablet App (`/tablet`)

The participant app is a fullscreen web app at `/tablet`, built for Android tablets running Chrome.
The flow is: pick a study → all videos download up front → enter a Participant ID → swipe through the blocks → results upload.

- **Studies** come from Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set (the same project the researcher pages at `/researcher/studies` write to); otherwise from `public/mock/studies.json` (sample videos in `public/mock/videos/`).
  See [Connecting the researcher front end](#connecting-the-researcher-front-end).
- **Swipe direction:** TikTok-style. Swipe **up** for the next block and **down** to go back (when the study allows it).
  To reverse it, set `NEXT_GESTURE` in `app/components/ReelsViewport/ReelsViewport.tsx` to `'down'`.
- **Laptop testing:** open `localhost:3000/tablet`. On a laptop the app shows as a phone-shaped column, like YouTube Shorts; on a touch tablet it fills the screen.
  Move between blocks by dragging with the mouse, scrolling with the trackpad or mouse wheel, or pressing the ↓ / ↑ arrow keys.
  Use Chrome: Safari blocks typing while a page is fullscreen.
- **Researcher exit:** tap the top-left corner 5 times quickly, then enter the PIN (`NEXT_PUBLIC_RESEARCHER_PIN`, default `0000`).
- **Results:** each finished session is saved on the tablet first, then uploaded. Failed uploads retry when the app is next opened.

### How a study is defined

The tablet app has **no study content built in**. Everything a participant sees comes from one `Study` object, which the researcher front end creates.
The exact format is in [`app/types/study.types.ts`](app/types/study.types.ts); that file is the contract between the two front ends.

A study is a list of **blocks**, shown in order (unless randomized). There are three kinds:

| `type`         | What it shows                    | Fields                                                              |
| -------------- | -------------------------------- | ------------------------------------------------------------------- |
| `instructions` | A text screen                    | `text`                                                              |
| `video`        | A full-screen looping video      | `videoUrl`, `fileName`, optional `title`, `description`, `comments` |
| `survey`       | A question with tappable options | `prompt`, `options` (list of answer strings)                        |

Every block also has an `id` (unique within the study), a `label` (the name used in the results, e.g. `"survey1"`), and an optional `randomGroup` (see below).

**To add, remove or reorder videos and surveys, edit the `blocks` list.** Nothing in the tablet code refers to a particular block.

A minimal study:

```json
{
  "id": "my-study",
  "name": "My Study",
  "randomized": false,
  "display": { "videoBar": true, "leftText": "Dislike", "rightText": "Like" },
  "controls": {
    "swipeUp": true,
    "responseButtons": true,
    "pausing": true,
    "audioRecord": false,
    "cameraRecord": false
  },
  "blocks": [
    { "id": "b1", "type": "instructions", "label": "instruction1", "text": "Swipe up to begin." },
    {
      "id": "b2",
      "type": "video",
      "label": "video1",
      "videoUrl": "https://example.com/videos/cat.mp4",
      "fileName": "cat.mp4",
      "title": "My cat",
      "description": "Caption text under the title",
      "comments": [{ "author": "sam", "text": "So cute", "likes": 12 }]
    },
    { "id": "b3", "type": "survey", "label": "survey1", "prompt": "Did you enjoy it?", "options": ["Yes", "No"] }
  ]
}
```

`public/mock/studies.json` has a fuller example with every feature turned on.

#### Turning features on and off

The newer settings (`shareOptions`, the comment / save / share buttons, `pauseOnShare`, `randomGroup`, captions and comments) can be left out entirely: left out means **off**, or the default shown, so older studies keep working. The rest are required.

| Setting                          | Where      | What it does                                                                                         |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `display.videoBar`               | `display`  | Thin progress bar along the bottom of each video                                                     |
| `display.leftText` / `rightText` | `display`  | Labels under the dislike / like buttons (`""` for none)                                              |
| `display.leftIcon` / `rightIcon` | `display`  | Image URLs to replace the thumbs-down / thumbs-up icons                                              |
| `display.shareOptions`           | `display`  | Options in the share panel. Default: Copy link, Messages, Email, Repost, More                        |
| `controls.responseButtons`       | `controls` | Show the like / dislike buttons (the main recorded response)                                         |
| `controls.commentButton`         | `controls` | Show the comment button; it opens a panel listing that video's `comments`                            |
| `controls.saveButton`            | `controls` | Show the save button; it toggles on/off like TikTok                                                  |
| `controls.shareButton`           | `controls` | Show the share button; it opens the share panel                                                      |
| `controls.pauseOnShare`          | `controls` | Pause the video while the share or comments panel is open. Default: keeps playing, like Shorts/Reels |
| `controls.pausing`               | `controls` | Tapping the video pauses / resumes it                                                                |
| `controls.swipeUp`               | `controls` | Participants can swipe back to the previous block                                                    |
| `randomized`                     | study      | Shuffle every block for each participant                                                             |
| `randomGroup`                    | block      | Blocks with the same `randomGroup` name are shuffled among themselves; all other blocks stay put     |
| video `title` / `description`    | block      | Caption in the bottom-left of the video. Blank hides it                                              |
| video `comments`                 | block      | Read-only comments shown when the comment button is tapped: `{ author, text, likes? }`               |

Comments, captions and share options are just text. Nothing is actually posted or shared.

### Connecting the researcher front end

The researcher front end (a separate app) and the tablet only need to agree on two things, both defined in `app/types/study.types.ts`:

1. **`Study`**: what the researcher front end saves and the tablet reads.
2. **`RunResult`**: what the tablet produces for each participant and the backend stores.

The tablet talks to the backend through one interface, `StudyRepository` in `app/utils/studies/StudyRepository.ts`:

```ts
interface StudyRepository {
  listStudies(): Promise<{ id: string; name: string }[]>; // the "Please Select Study" list
  getStudy(id: string): Promise<Study>; // the full study, fetched when it's selected
  submitRun(run: RunResult): Promise<void>; // one finished session; reject on failure so it is retried
}
```

**The Supabase implementation is in place:** `app/utils/studies/supabaseRepository.ts`, using the row ↔ `Study` / `RunResult` conversions in `app/utils/studies/supabaseMapping.ts`. `app/utils/studies/index.ts` picks it automatically when the two Supabase env vars are set, and falls back to the mock otherwise. Runs are uploaded through the `submit_run` database function, which ignores a retried upload of the same session. Field-by-field mapping, migrations and access rules: [`docs/supabase-alignment.md`](docs/supabase-alignment.md).

To use a different backend instead:

1. Write a new implementation next to `mockRepository.ts`. For a plain REST API it is about this much code:

   ```ts
   // app/utils/studies/httpRepository.ts
   import type { RunResult, Study } from '@/app/types';
   import type { StudyRepository, StudySummary } from './StudyRepository';

   const API = process.env.NEXT_PUBLIC_API_URL;

   async function request<T>(path: string, init?: RequestInit): Promise<T> {
     const response = await fetch(`${API}${path}`, init);
     if (!response.ok) throw new Error(`${path} failed (${response.status})`);
     return response.status === 204 ? (undefined as T) : response.json();
   }

   export const httpRepository: StudyRepository = {
     listStudies: () => request<StudySummary[]>('/studies'),
     getStudy: (id) => request<Study>(`/studies/${encodeURIComponent(id)}`),
     submitRun: (run: RunResult) =>
       request<void>('/runs', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(run),
       }),
   };
   ```

   Firebase or anything else works the same way: just fill in those three functions.

2. Change `app/utils/studies/index.ts` to `export const studyRepository = httpRepository;`.

Things to keep in mind:

- **Edits apply from the next session.** The tablet fetches the study when it is selected, so changes made in the researcher front end show up for the next participant.
- **Video and icon URLs are downloaded with `fetch`** before the session starts, so the server hosting them must allow the tablet's origin (CORS), and the URLs must be reachable from the tablet.
- **New block types need tablet code.** Researchers can use instructions, video and survey blocks in any number and order; a brand-new kind of block (e.g. an image or free-text question) needs a new slide component.

### Getting the results (CSV / data)

When a participant finishes, the tablet calls `submitRun(run)` with a `RunResult`. That JSON object is the raw data; store it as-is (e.g. one row in a `runs` table, or one document per run).

```jsonc
{
  "studyId": "my-study",
  "studyName": "My Study",
  "participantId": "P001",
  "startedAtIso": "2026-10-26T15:00:00.000Z",
  "completedAtIso": "2026-10-26T15:04:12.000Z",
  "blockOrder": ["b1", "b2", "b3"], // order this participant saw (differs when randomized)
  "rows": [
    {
      "blockId": "b2",
      "order": 2,
      "stimulus": "cat.mp4", // video fileName, or the block label
      "watchTimeMs": 8123,
      "swipedUp": 0, // 1 if they left by swiping back
      "buttonPress": "Right", // Left/Right for videos, the chosen option for surveys
      "buttonTimeMs": 2410,
      "shareTimeMs": 3900, // first share tap, null if never
      "shareChoice": "Copy link", // option picked, "Cancel", or null
      "commentTimeMs": null, // first comment tap
      "saveTimeMs": 5100, // first save tap
      "saved": 1, // saved when they left the video
      "startedAtIso": "2026-10-26T15:00:05.000Z",
    },
  ],
}
```

There is **one row per viewing**: if a participant swipes back to a block, that return visit is a new row. All times are milliseconds measured from when the block appeared.

**To turn a run into a CSV**, use the helpers in `app/utils/runner/toCsvRows.ts` (a TypeScript researcher front end or Node backend can import them directly):

```ts
import { toCsv } from '@/app/utils/runner';

const csvText = toCsv(run); // one CSV per participant session
```

The CSV follows the design document's layout, with the side-button columns added at the end:

| Column         | From            | Notes                                              |
| -------------- | --------------- | -------------------------------------------------- |
| `Blocks`       | `blockId`       | First two rows are `Study_ID` and `Participant_ID` |
| `Order`        | `order + 2`     |                                                    |
| `Stimuli`      | `stimulus`      |                                                    |
| `Watch_time`   | `watchTimeMs`   | e.g. `8123 ms`                                     |
| `Swipe_up?`    | `swipedUp`      | `0` / `1`                                          |
| `Button_press` | `buttonPress`   | `0` if none                                        |
| `Button_time`  | `buttonTimeMs`  | `0` if none                                        |
| `Share_time`   | `shareTimeMs`   | `0` if none                                        |
| `Share_choice` | `shareChoice`   | `0` if none                                        |
| `Comment_time` | `commentTimeMs` | `0` if none                                        |
| `Save_time`    | `saveTimeMs`    | `0` if none                                        |
| `Saved`        | `saved`         | `0` / `1`                                          |

If the backend is in another language (e.g. Python), store the JSON and rebuild the CSV from this table; it is a straight field-by-field mapping.

**While still on the mock backend**, finished runs are kept in the browser's localStorage. To grab them, open DevTools on the tablet page and run:

```js
JSON.parse(localStorage.getItem('mock-submitted-runs'));
```

### Tablet setup (kiosk mode)

1. Open the site's `/tablet` page in Chrome on the tablet and choose **⋮ → Add to Home screen / Install app**. The app then launches fullscreen in portrait.
2. In Android **Settings → Security (or Security & privacy) → More security settings → App pinning**, turn it on along with **Ask for PIN before unpinning**.
3. Open the installed app, open **Recents**, tap the app's icon, and choose **Pin**. Participants can't leave the app without the device PIN.
4. Optional, for stricter labs: a kiosk browser such as Fully Kiosk Browser can lock the tablet further.

Fullscreen and keep-screen-awake only work over HTTPS (or `localhost`). To test on a tablet against your laptop, either:

- connect over USB and use `chrome://inspect` → **Port forwarding** (`3000 → localhost:3000`), then open `localhost:3000/tablet` on the tablet, or
- run `npx next dev --experimental-https -H 0.0.0.0` and open `https://<your-laptop-ip>:3000/tablet`.
