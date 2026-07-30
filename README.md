# TCS Quiz 2026

TCS Quiz 2026 is a standalone, no-login study portal for the fifteen-module 2026 TCS Quiz roadmap. It is a dependency-free static site: browser ES modules, JSON data, and one stylesheet.

## What is in it

- **Fifteen roadmap modules.** Each module has ranked fact cards, concise explainers, exam-relevance scores, tags, and connection links.
- **Practice that fits the roadmap.** Rapid MCQ, timed module test, mixed mock, and Deep Module Set modes provide scored answers, explanations, and retry-wrongs review.
- **Revision and progress.** Mark facts as read, review missed questions and older cards, and see progress across the roadmap.
- **Study tools.** Search, dark mode, topic maps, an ultra map, and a personal map remain available for connecting facts.
- **Portable progress.** Read history, answers, and review state stay only in this browser under the `tcsquiz.` storage namespace.

## Backup and restore

Use **Backup** in the site to download a versioned JSON copy of your progress before clearing browser data or moving to another device. Restore accepts only a valid TCS Quiz 2026 backup and validates it before replacing the current browser state; incompatible or corrupt files leave existing progress unchanged. The site has no account or hosted sync service.

## Run locally

No package installation or build step is required to browse the site. It must be served over HTTP because module data is fetched as JSON:

```bash
python3 -m http.server 8080 --directory .
```

Open <http://127.0.0.1:8080>. Do not open `index.html` directly from the filesystem.

When content changes, regenerate and validate the legacy index plus the TCS module corpus:

```bash
node scripts/build-index.mjs
```

Run the full local verification, including the HTTP smoke test:

```bash
node scripts/build-index.mjs && node --test test/*.test.mjs && python3 -m http.server 8091 --directory . >/tmp/tcs-quiz-http.log 2>&1 & SERVER_PID=$!; sleep 1; node --test test/smoke.mjs; STATUS=$?; kill $SERVER_PID; exit $STATUS
```

## Deploy as its own GitHub Pages site

Keep this project in a repository separate from the original CLAT study portal and any personal site. From a checkout of this project, create and push a dedicated repository named `tcs-quiz-2026`:

```bash
git remote add origin https://github.com/<OWNER>/tcs-quiz-2026.git
git push -u origin main
```

On GitHub, open **Settings → Pages** for `tcs-quiz-2026`, choose **GitHub Actions** as the source, and save. The included `.github/workflows/deploy.yml` runs on every push to `main`: it validates and rebuilds the manifest, uploads the static files, and deploys them to GitHub Pages. After the first successful deployment, GitHub shows the published URL on the Pages settings screen and in the workflow summary.

## Layout

```
index.html                  application shell
assets/css/app.css          design system
assets/js/app.js            routes and study views
assets/js/tcs-data.js       module loading and validation
assets/js/tcs-quiz.js       pure quiz builder and scoring helpers
assets/js/study-state.js    browser progress, backup, and revision helpers
data/modules/               fifteen-module roadmap manifest and content
scripts/build-index.mjs     manifest builder and corpus validator
test/                       Node unit tests and HTTP smoke test
docs/                       product, schema, voice, and design notes
```
