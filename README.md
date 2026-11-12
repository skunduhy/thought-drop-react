# Thought Drop

Thought Drop lets you write a personal note, split it into paragraphs, and share it as a book-page-style reader view.

## Run locally

```sh
npm install
npm run dev
```

## Sharing

Each share link uses a seven-character uppercase letter/number path, followed by a URL fragment containing the note. For example: `/7KQ2M9A#note=...`. The fragment makes the link self-contained, so no account or server-side message storage is required. Anyone with the full link can read the note.

When deploying, configure the static host to serve `index.html` for unknown paths so links such as `/7KQ2M9A` load the app.
