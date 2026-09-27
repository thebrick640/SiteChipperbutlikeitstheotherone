# Coolbrador

A static HTML/JS social site on Firebase Hosting, Auth and Firestore, including
the Chipper in-game (Miiverse-style) feed.

## Local development

Requirements: Node 20+ and Java 21 (`mise install` reads `mise.toml`).

```sh
npm ci
npm run dev     # Auth/Firestore/Storage emulators + dev server on :8000
npm run serve   # dev server only, against production Firebase
npm test        # security-rules tests against the emulators
```

`tools/dev-server.mjs` mirrors the `firebase.json` Hosting routing (redirects,
static files, rewrites, 404). In emulator mode it proxies the emulators on the
same origin and injects `window.__CB_EMULATOR__`, which `js/firebase.js` uses to
connect to them, so local and preview sessions never touch production data.
Emulator data persists in `.emulator-data/` (delete it to start fresh).

## Deploying

```sh
firebase deploy --only hosting,firestore:rules,storage,functions
```

Hosting deploys the repository root; `firebase.json` `hosting.ignore` keeps
tooling, tests, backups and server code out of the public site.
