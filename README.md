# Thought Drop

Write a page for someone and share it. Every page looks like a sheet from a book.

## How it works

- `/` is a book-cover landing page with two choices: **Write a page** or **Read a sample page** (`/SAMPLE1`, rendered from `src/data/samplePage.json` without a Firebase request). The sample has a title, greeting, and 400-word Lorem Ipsum message, using the same book layout as published pages without a sample badge. Sample visits aren't tracked.
- `/write` is the writing page. A title, opening greeting, and signature are optional, and each line break in the message starts a new paragraph. The greeting appears as a normal salutation, followed by the message with a decorative initial.
- **Insert page break** adds a `[page break]` line at the cursor. Readers see one fixed-height book page at a time (880px on desktop, 720px on phones), with **Previous / Next** controls. Overflow continues automatically onto another page; a page-break line starts the following content on a new page. Break markers count toward the 5,000-character limit and aren't shown to readers. Consecutive breaks don't create empty pages.
- To publish, the writer signs in with Google. **Only admin accounts can publish.** The page is saved in Cloud Firestore under a random seven-character code made from `A-Z` and `0-9`.
- The shareable link is just that code, for example `https://your-site/7KQ2M9A`. Readers don't need to sign in, and the reader page works on phones.
- `/admin` lists every page with how many times it was opened and when it was last seen. `/admin/7KQ2M9A` shows the reader activity for one page, and lets the admin unpublish it, publish it again, or delete it. Both are admin-only.

Routing uses [React Router](https://reactrouter.com/) (`BrowserRouter` in `src/main.jsx`, route definitions in `src/aRouter.jsx`, and individual pages in `src/pages/`).

## Reader activity

When someone opens a published page, the app records a **visit** in `pages/{code}/visits/{visitId}`:

| Field                       | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `startedAt`                 | When the page was opened (server time)                                      |
| `lastSeenAt`                | Last update from the reader; once `ended` is true, this is when they closed it |
| `activeMs`                  | Time the page was actually visible (time on another tab or app isn't counted) |
| `maxScroll`                 | Furthest reading progress across all book pages, 0–100%                    |
| `scrolls`, `taps`           | Number of scroll gestures and taps/clicks                                   |
| `hiddenCount`               | How many times they switched away                                           |
| `events`                    | Timeline: opened, turned to a numbered page, reached the end, switched away, came back, closed (up to 60) |
| `ended`                     | `true` once the page was closed                                             |
| `device`, `browser`, `screen` | Mobile/tablet/desktop, browser name, screen size                          |
| `visitorId`                  | Random anonymous ID from local storage, used to group visits in the same browser |

While the page is visible, the visit is updated every 10 seconds, and again when the reader switches away or closes it. The update sent on close uses `fetch(..., { keepalive: true })` so it's still delivered while the tab is closing. A reader who is offline, or whose browser is killed, may lose up to the last 10 seconds. The author previewing their own page isn't counted.

Turning a book page also updates reading progress immediately and records the page number in the activity timeline. Scrolling on the first page doesn't count as finishing the whole message: the "reached the end" event requires opening the final page and bringing its content area into view. Going back never reduces the furthest progress already recorded. The admin's completion badges use this event for paginated visits; older visits retain their previous scroll-based completion status.

The browser ID is a random identifier for this site's browser profile, not a hardware ID or a verified identity. A different browser or private window, or cleared local storage, will appear as a different browser. Readers without available local storage are still tracked, but cannot be grouped across visits.

The rules let anyone record a visit to an existing page, but only admins can read visits. Updates can only increase the counters, and `activeMs` can't exceed the real time since the visit started. The reader page includes a short notice that the sender can see when the page is read.

Pages are stored in the Firestore collection `pages`, with the code as the document ID:

| Field       | Description                              |
| ----------- | ---------------------------------------- |
| `title`     | Optional title (up to 80 characters)     |
| `greeting`  | Optional opening greeting (up to 100 characters) |
| `message`   | The message (up to 5,000 characters)     |
| `sender`    | Signature; defaults to the Google name   |
| `authorUid` | Firebase Auth UID of the writer          |
| `createdAt` | Server timestamp                         |

The security rules in [`firestore.rules`](firestore.rules) allow anyone to read a page by its code only while it's published (`published: true`); unpublished and unknown codes both show "page couldn't be found". Only admins can list pages, create them (as themselves), unpublish or republish them, and delete them along with their visits.

## Admins

The admin list is hardcoded in [`firestore.rules`](firestore.rules), in the `isAdmin()` function:

```
request.auth.token.email.lower() in [
  'sample@example.com'
]
```

Replace `sample@example.com` with the admin's Google email. To add more admins, separate the emails with commas, for example `'a@gmail.com', 'b@gmail.com'`. Use lowercase. You can change the list in either of two ways:

- Edit the file and run `npx firebase-tools deploy --only firestore:rules`.
- Edit the rules in **Firebase console → Firestore Database → Rules** and click **Publish**. If you do, copy the same change into `firestore.rules`; otherwise your next deploy from this project will overwrite it.

Anyone else who signs in can't publish: the app shows a message saying only the admin can publish pages.

## Firebase setup

1. Create a project at <https://console.firebase.google.com> and add a **Web app**.
2. **Authentication → Sign-in method:** enable **Google**.
3. **Authentication → Settings → Authorized domains:** add each domain you serve the app from. `localhost` is included by default; use `http://localhost:5173` rather than `127.0.0.1` when developing.
4. **Firestore Database:** create a database.
5. Copy `.env.example` to `.env.local` and fill in the web app config values.
6. Deploy the security rules:

   ```sh
   npx firebase-tools login
   npx firebase-tools use --add          # choose your project
   npx firebase-tools deploy --only firestore:rules
   ```

## Run locally

```sh
npm install
npm run dev
```

### With the Firebase emulators (optional)

Requires Java 11 or later. Set `VITE_FIREBASE_USE_EMULATORS=true` in `.env.local`. Any non-empty placeholder values work for the other settings, for example `VITE_FIREBASE_PROJECT_ID=demo-thought-drop`. Then run:

```sh
npx firebase-tools emulators:start --project demo-thought-drop
npm run dev
```

## Deploy

[`firebase.json`](firebase.json) serves `dist/` and rewrites every path to `index.html`, so links like `/7KQ2M9A` load the app. `firebase-tools` is a dev dependency, so `npx firebase` uses the version pinned in `package-lock.json`.

To deploy by hand:

```sh
npm run build
npx firebase deploy --only hosting,firestore:rules
```

### GitHub Actions

[`.github/workflows/firebase-deploy.yml`](.github/workflows/firebase-deploy.yml) runs on every push to `main`, and you can also start it from the **Actions** tab (**Run workflow**). It installs dependencies, lints, builds with your Firebase config, and deploys Hosting and the Firestore rules.

One-time setup:

1. **Create a service account.** In Google Cloud console → **IAM & Admin → Service accounts** for your Firebase project, create one with these roles:
   - Firebase Hosting Admin
   - Firebase Rules Admin
   - API Keys Viewer
   - Service Usage Consumer

   Open the account → **Keys → Add key → JSON** and download the key file.
2. **Add the secret and variables in GitHub.** Go to **Settings → Environments → New environment** and name it `production`. Add:

   | Type     | Name                         | Value                                   |
   | -------- | ---------------------------- | --------------------------------------- |
   | Secret   | `FIREBASE_SERVICE_ACCOUNT`   | The full contents of the JSON key file  |
   | Variable | `VITE_FIREBASE_API_KEY`      | From your Firebase web app config       |
   | Variable | `VITE_FIREBASE_AUTH_DOMAIN`  | e.g. `your-project.firebaseapp.com`     |
   | Variable | `VITE_FIREBASE_PROJECT_ID`   | e.g. `your-project`                     |
   | Variable | `VITE_FIREBASE_APP_ID`       | From your Firebase web app config       |

   The web config values end up in the public JavaScript bundle anyway, so they're variables. Only the service account key is a secret. If any of these are missing, the workflow stops at the first step and lists them.
3. **Allow Google sign-in on the live site.** In Firebase console → **Authentication → Settings → Authorized domains**, make sure `your-project.web.app`, `your-project.firebaseapp.com` and any custom domain are listed.

The deploy publishes `firestore.rules` from this repository. That includes the admin list, so change admins in the file and push, rather than only editing the rules in the Firebase console.
