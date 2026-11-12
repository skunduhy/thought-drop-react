# Thought Drop

Write a page for someone and share it. Every page looks like a sheet from a book.

## How it works

- `/` is a book-cover landing page with two choices: **Write a page** or **Read a sample page**.
- **Write a page** opens a new page with a random seven-character address made from `A-Z` and `0-9`, such as `/7KQ2M9A`.
- The sender writes on that page. A title and signature are optional, and each line break starts a new paragraph.
- **Share this page** creates the reader link: `/7KQ2M9A#note=...`. Whoever opens it sees the same page in reading mode.
- `/SAMPLE1` is a built-in sample page that shows what a reader sees.

There is no server-side storage. The note is encoded in the URL fragment, so anyone with the full link can read it.

## Run locally

```sh
npm install
npm run dev
```

When you deploy, configure the static host to serve `index.html` for unknown paths so that addresses such as `/7KQ2M9A` load the app.
