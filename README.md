# Thought Drop

Write a page for someone and share it. Every page looks like a sheet from a book.

## How it works

- `/` is a book-cover landing page with two choices: **Write a page** or **Read a sample page** (`/SAMPLE1`, built into the app).
- `/write` is the writing page. A title and signature are optional, and each line break starts a new paragraph.
- To publish, the writer signs in with Google. **Only admin accounts can publish.** The page is saved in Cloud Firestore under a random seven-character code made from `A-Z` and `0-9`.
- The shareable link is just that code, for example `https://your-site/7KQ2M9A`. Readers don't need to sign in, and the reader page works on phones.
- `/admin` lists every published page with how many times it was opened and when it was last seen. `/admin/7KQ2M9A` shows the reader activity for one page. Both are admin-only.

Routing uses [React Router](https://reactrouter.com/) (`BrowserRouter` in `src/main.jsx`, routes in `src/App.jsx`).

## Reader activity

When someone opens a published page, the app records a **visit** in `pages/{code}/visits/{visitId}`:

| Field                       | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `startedAt`                 | When the page was opened (server time)                                      |
| `lastSeenAt`                | Last update from the reader; once `ended` is true, this is when they closed it |
| `activeMs`                  | Time the page was actually visible (time on another tab or app isn't counted) |
| `maxScroll`                 | How far down they scrolled, 0–100%                                          |
| `scrolls`, `taps`           | Number of scroll gestures and taps/clicks                                   |
| `hiddenCount`               | How many times they switched away                                           |
| `events`                    | Timeline: opened, reached the end, switched away, came back, closed (up to 60) |
| `ended`                     | `true` once the page was closed                                             |
| `device`, `browser`, `screen` | Mobile/tablet/desktop, browser name, screen size                          |

While the page is visible, the visit is updated every 10 seconds, and again when the reader switches away or closes it. The update sent on close uses `fetch(..., { keepalive: true })` so it's still delivered while the tab is closing. A reader who is offline, or whose browser is killed, may lose up to the last 10 seconds. The author previewing their own page isn't counted.

The rules let anyone record a visit to an existing page, but only admins can read visits. Updates can only increase the counters, and `activeMs` can't exceed the real time since the visit started. The reader page includes a short notice that the sender can see when the page is read.

Pages are stored in the Firestore collection `pages`, with the code as the document ID:

| Field       | Description                              |
| ----------- | ---------------------------------------- |
| `title`     | Optional title (up to 80 characters)     |
| `message`   | The message (up to 5,000 characters)     |
| `sender`    | Signature; defaults to the Google name   |
| `authorUid` | Firebase Auth UID of the writer          |
| `createdAt` | Server timestamp                         |

The security rules in [`firestore.rules`](firestore.rules) allow anyone to read a single page by its code. Only admins can list pages. Only admins can create pages, they must create them as themselves, and published pages can't be edited or deleted.

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

[`firebase.json`](firebase.json) serves `dist/` and rewrites every path to `index.html`, so links like `/7KQ2M9A` load the app:

```sh
npm run build
npx firebase-tools deploy
```
