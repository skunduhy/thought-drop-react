# Thought Drop

Write a page for someone and share it. Every page looks like a sheet from a book.

## How it works

- `/` is a book-cover landing page with two choices: **Write a page** or **Read a sample page** (`/SAMPLE1`, built into the app).
- `/write` is the writing page. A title and signature are optional, and each line break starts a new paragraph.
- To publish, the writer signs in with Google. The page is saved in Cloud Firestore under a random seven-character code made from `A-Z` and `0-9`.
- The shareable link is just that code, for example `https://your-site/7KQ2M9A`. Readers don't need to sign in, and the reader page works on phones.

Pages are stored in the Firestore collection `pages`, with the code as the document ID:

| Field       | Description                              |
| ----------- | ---------------------------------------- |
| `title`     | Optional title (up to 80 characters)     |
| `message`   | The message (up to 5,000 characters)     |
| `sender`    | Signature; defaults to the Google name   |
| `authorUid` | Firebase Auth UID of the writer          |
| `createdAt` | Server timestamp                         |

The security rules in [`firestore.rules`](firestore.rules) allow anyone to read a single page by its code. They don't allow listing pages. Only signed-in users can create pages, they must create them as themselves, and published pages can't be edited or deleted.

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
