# TCS Quiz Library and Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every line of the TCS Quiz Comprehensive Prep Document in a searchable study library and add a passwordless, Google-authenticated revision queue that synchronizes across devices.

**Architecture:** Extract the existing static application into the repository, generate a lossless JSON study library from the Drive document, and render it through the existing vanilla JavaScript site. Add isolated modules for source lookup, spaced-repetition scheduling, Firebase configuration, authentication, and per-user Firestore persistence; the UI will use these modules without exposing Firebase credentials beyond public web configuration.

**Tech Stack:** Static HTML/CSS/ES modules, Node.js test runner, Firebase Authentication, Cloud Firestore, GitHub Actions, GitHub Pages.

## Global Constraints

- Preserve every non-empty line from the source document in original order and retain its module context.
- Public visitors can browse and search content without authentication.
- Revision queues, profiles, and answer history are private and keyed by Firebase `uid`.
- Use Google sign-in; never add Firebase Admin credentials or private keys to the repository.
- Publish only through `iamdarshg/tcs-quiz` at `/tcs-quiz/`.

---

### Task 1: Materialize the existing static site and deploy it directly

**Files:**
- Create: all application files extracted from `tcs-quiz-2026.zip`
- Modify: `.github/workflows/deploy-pages.yml`
- Test: `test/smoke.mjs`

**Interfaces:**
- Produces: a repository-root static site with `index.html`, `assets/`, `data/`, `scripts/`, and `test/` available to subsequent tasks.

- [ ] **Step 1: Extract the archive into a temporary directory and compare its paths with the repository root.**

Run: `Expand-Archive -LiteralPath tcs-quiz-2026.zip -DestinationPath .tmp-site -Force; Get-ChildItem .tmp-site -Force`

- [ ] **Step 2: Copy site paths into the repository while preserving the root deployment workflow and design documents.**

Copy: `index.html`, `assets/`, `data/`, `scripts/`, `test/`, and source documentation from `.tmp-site` to the repository root.

- [ ] **Step 3: Change Pages deployment to upload the checked-out repository rather than re-extracting the archive.**

Replace the build extraction step with `actions/upload-pages-artifact@v3` using `path: .` and exclusions for `.git`, `test`, and `docs` through a staging directory.

- [ ] **Step 4: Run the existing smoke test.**

Run: `node test/smoke.mjs`

- [ ] **Step 5: Commit the independently deployable source tree.**

Run: `git add index.html assets data scripts test .github/workflows/deploy-pages.yml && git commit -m "Extract TCS quiz site source"`

### Task 2: Build a lossless prep-document ingestion pipeline

**Files:**
- Create: `scripts/build-prep-library.mjs`
- Create: `data/prep-library.json`
- Create: `test/prep-library.test.mjs`

**Interfaces:**
- Consumes: UTF-8 plain text export of the Drive document.
- Produces: `buildPrepLibrary(sourceText) -> { sourceLineCount, modules: Array<{id,title,lines:Array<{sourceLine,text}>}> }`.

- [ ] **Step 1: Write the failing ingestion test.**

```js
import assert from 'node:assert/strict';
import { buildPrepLibrary } from '../scripts/build-prep-library.mjs';

const library = buildPrepLibrary('1. Foundations\nA line\n\n2. Networks\nAnother line');
assert.deepEqual(library.modules.map(({ id, lines }) => [id, lines.map(line => line.text)]), [
  ['01', ['1. Foundations', 'A line']],
  ['02', ['2. Networks', 'Another line']],
]);
```

- [ ] **Step 2: Run the test and verify it fails because `buildPrepLibrary` is missing.**

Run: `node test/prep-library.test.mjs`

- [ ] **Step 3: Implement the parser and command-line writer.**

The parser must normalize line endings only, skip blank lines only, assign monotonically increasing original `sourceLine` values, recognize numbered module headings, and keep unmatched text in a `00` preface module.

- [ ] **Step 4: Run the test and verify it passes.**

Run: `node test/prep-library.test.mjs`

- [ ] **Step 5: Fetch the complete Google Doc text through the Drive connector, save it as `data/source/tcs-quiz-prep.txt`, and generate `data/prep-library.json`.**

Run: `node scripts/build-prep-library.mjs data/source/tcs-quiz-prep.txt data/prep-library.json`

- [ ] **Step 6: Add a losslessness assertion and re-run the test.**

Assert that the generated JSON's line count equals the source's non-empty line count and that the first and final source lines appear verbatim.

- [ ] **Step 7: Commit the source, generator, generated library, and tests.**

Run: `git add scripts/build-prep-library.mjs data/source/tcs-quiz-prep.txt data/prep-library.json test/prep-library.test.mjs && git commit -m "Add complete TCS prep library"`

### Task 3: Render and search the complete study library

**Files:**
- Create: `assets/js/prep-library.js`
- Modify: `assets/js/app.js`
- Modify: `index.html`
- Modify: `assets/css/app.css`
- Create: `test/prep-library-ui.test.mjs`

**Interfaces:**
- Consumes: `loadPrepLibrary(url) -> Promise<Library>` and `searchPrepLines(library, query) -> Array<Line>`.
- Produces: module navigation, a search result list, and source-line anchors of the form `#prep-<sourceLine>`.

- [ ] **Step 1: Write the failing search test.**

```js
import assert from 'node:assert/strict';
import { searchPrepLines } from '../assets/js/prep-library.js';

const results = searchPrepLines({ modules: [{ lines: [{ sourceLine: 7, text: 'Ada Lovelace wrote notes' }] }] }, 'lovelace');
assert.equal(results[0].sourceLine, 7);
```

- [ ] **Step 2: Run the test and verify it fails because the module is missing.**

Run: `node test/prep-library-ui.test.mjs`

- [ ] **Step 3: Implement library loading, case-insensitive search, and safe text-node rendering.**

Use `textContent`, never `innerHTML`, for source material. Render each preserved line with its source-line anchor and module heading.

- [ ] **Step 4: Add the Library tab, search input, results status, and responsive source-line styling.**

- [ ] **Step 5: Run the focused and existing test suites.**

Run: `node test/prep-library-ui.test.mjs; node test/smoke.mjs`

- [ ] **Step 6: Commit the public study-library UI.**

Run: `git add assets/js/prep-library.js assets/js/app.js assets/css/app.css index.html test/prep-library-ui.test.mjs && git commit -m "Add searchable TCS prep library"`

### Task 4: Implement automatic spaced repetition as pure, testable logic

**Files:**
- Create: `assets/js/revision-scheduler.js`
- Create: `test/revision-scheduler.test.mjs`

**Interfaces:**
- Produces: `scheduleReview(card, grade, now) -> { dueAt, intervalDays, repetitions }`, `dueCards(cards, now) -> Card[]`, and `starterQueue(lines, limit) -> Card[]`.
- Grades: `again`, `hard`, `good`, `easy`.

- [ ] **Step 1: Write the failing scheduling test.**

```js
import assert from 'node:assert/strict';
import { scheduleReview } from '../assets/js/revision-scheduler.js';

const now = new Date('2026-07-29T12:00:00Z');
assert.equal(scheduleReview({ repetitions: 0 }, 'again', now).dueAt, '2026-07-29T12:10:00.000Z');
assert.equal(scheduleReview({ repetitions: 1, intervalDays: 1 }, 'easy', now).intervalDays, 3);
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `node test/revision-scheduler.test.mjs`

- [ ] **Step 3: Implement the deterministic scheduling table.**

Use 10 minutes for `again`; 1 day for first `hard`; multiply existing intervals by 1.5 for `hard`, 2 for `good`, and 3 for `easy`; round up to whole days; increment repetitions unless grade is `again`.

- [ ] **Step 4: Add failing tests for due-card filtering and stable starter-card ordering, then implement both functions.**

Run: `node test/revision-scheduler.test.mjs`

- [ ] **Step 5: Commit the revision engine.**

Run: `git add assets/js/revision-scheduler.js test/revision-scheduler.test.mjs && git commit -m "Add automatic revision scheduler"`

### Task 5: Add Firebase Google sign-in and private per-user queue storage

**Files:**
- Create: `assets/js/firebase-config.js`
- Create: `assets/js/revision-store.js`
- Create: `assets/js/auth.js`
- Modify: `assets/js/app.js`
- Modify: `index.html`
- Create: `firestore.rules`
- Create: `test/revision-store.test.mjs`

**Interfaces:**
- Consumes: `firebaseConfig` exported from `firebase-config.js`.
- Produces: `signInWithGoogle()`, `signOut()`, `observeUser(callback)`, `getUserQueue(uid)`, and `saveUserQueue(uid, queue)`.

- [ ] **Step 1: Write the failing per-user path test.**

```js
import assert from 'node:assert/strict';
import { userQueuePath } from '../assets/js/revision-store.js';

assert.equal(userQueuePath('firebase-user-123'), 'users/firebase-user-123/revision/state');
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `node test/revision-store.test.mjs`

- [ ] **Step 3: Implement Firebase initialization guarded by an explicit `configured` flag.**

Use the Firebase CDN modular SDK. If public web configuration is absent, render a non-destructive "sync setup required" state and leave public study features working.

- [ ] **Step 4: Implement Google sign-in and Firestore profile/queue reads and writes.**

Create the user profile at `users/<uid>/profile` and revision state at `users/<uid>/revision/state`. Prompt once for a username, validate 3–24 letters, numbers, underscores, or hyphens, and store it with the UID.

- [ ] **Step 5: Add Firestore rules and run focused tests.**

```text
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Run: `node test/revision-store.test.mjs`

- [ ] **Step 6: Commit passwordless account support.**

Run: `git add assets/js/firebase-config.js assets/js/revision-store.js assets/js/auth.js assets/js/app.js index.html firestore.rules test/revision-store.test.mjs && git commit -m "Add Google sign-in revision accounts"`

### Task 6: Connect the revision UI, verify, deploy, and document Firebase setup

**Files:**
- Modify: `assets/js/app.js`
- Modify: `assets/css/app.css`
- Modify: `README.md`
- Create: `docs/firebase-setup.md`
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: library lines, authenticated user state, store methods, and scheduler methods.
- Produces: a due-now revision experience that saves each answer and refreshes automatically.

- [ ] **Step 1: Write a failing integration test for automatic queue selection.**

```js
import assert from 'node:assert/strict';
import { selectRevisionCard } from '../assets/js/app.js';

assert.equal(selectRevisionCard([{ dueAt: '2026-07-28T00:00:00.000Z' }], new Date('2026-07-29T00:00:00.000Z')).dueAt, '2026-07-28T00:00:00.000Z');
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `node test/revision-ui.test.mjs`

- [ ] **Step 3: Implement the account panel and queue flow.**

On authentication, load the user's state, create a starter queue when none exists, display the oldest due card, schedule the selected grade, save it, and immediately select the next due card. On sign-out, clear personalized data from the page.

- [ ] **Step 4: Document exact Firebase console setup.**

Document creation of a Firebase project, web app registration, Google provider activation, authorized domain `iamdarshg.github.io`, Firestore database creation, rules deployment, and copying only public web configuration into `assets/js/firebase-config.js`.

- [ ] **Step 5: Run all tests and deploy verification.**

Run: `Get-ChildItem test/*.test.mjs | ForEach-Object { node $_.FullName }; node test/smoke.mjs`

Run: `git push origin main; gh run watch --repo iamdarshg/tcs-quiz --exit-status`

- [ ] **Step 6: Confirm the deployed project page serves the library.**

Run: `Invoke-WebRequest https://iamdarshg.github.io/tcs-quiz/ -UseBasicParsing`

- [ ] **Step 7: Commit final UI and documentation.**

Run: `git add assets/js/app.js assets/css/app.css README.md docs/firebase-setup.md .github/workflows/deploy-pages.yml test/revision-ui.test.mjs && git commit -m "Connect synced revision queue"`
