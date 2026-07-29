# TCS Quiz library and personalized revision design

## Goal

Expand the standalone TCS Quiz GitHub Pages site into a complete study library containing every line of the "TCS Quiz Comprehensive Prep Document", while adding a secure, passwordless, cross-device revision queue.

## Content model

- Store a lossless transcription of the source document in the repository as structured data.
- Preserve source order and every non-empty source line. Each item records its module, source order, and text.
- Present the material in a searchable library, grouped by the document's numbered modules.
- Generate revision cards only from the preserved content. Each card links back to its study section so a learner can revise the original material in context.
- Keep the complete library public. Authentication is not required to browse or search it.

## Accounts and privacy

- Use Firebase Authentication with Google sign-in. Learners choose a revision username after their first sign-in.
- Use Firestore with records scoped by Firebase user ID. A user can read and write only their own profile, review queue, and answer history.
- The username is a display identifier, not an authentication secret. Google identity prevents another user from accessing the same revision history.
- Until the Firebase web configuration is supplied, the UI will clearly indicate that cross-device sync is not configured rather than silently pretending to persist accounts.

## Automatic revision queue

- Each user has an independent queue keyed by their Firebase user ID.
- Reviewing a card updates a simple spaced-repetition schedule: incorrect or "again" responses become due soon; hesitant responses return sooner than confident responses; confident responses progressively lengthen the interval.
- On sign-in and on page load, the site fetches due cards automatically and promotes them to the revision queue.
- Queue state and review history are written to Firestore so they follow the user across devices.
- A first-time user receives a small starter set, then the queue expands from the study library as cards are completed.

## Pages deployment

- The project continues to deploy only from `iamdarshg/tcs-quiz` through its existing Pages workflow.
- It remains a project site at `/tcs-quiz/`, so it does not affect the account-level personal website.
- Firebase public web configuration may be committed; secret admin credentials must never be added to the repository or client code.

## Validation

- Automated tests cover lossless source-line ingestion, content lookup, revision scheduling, and per-user storage paths.
- The Pages workflow builds and deploys the static site.
- A post-deploy HTTP check confirms the project URL serves the built page.

## Required configuration

The live account feature needs a Firebase project with Google sign-in enabled, a Firestore database, and the Firebase web configuration. The project should authorize `https://iamdarshg.github.io` as an allowed domain. Firebase security rules must scope all revision data to `request.auth.uid`.
