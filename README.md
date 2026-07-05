# RSSFeed

A small, modern **news feed** app. Sign in to the desk, write posts in plain text
(with an author byline), and every published post is served as **RSS 2.0**,
**Atom 1.0**, and **JSON Feed** for other services to pull — including Grafana's
News panel and Confluence's RSS macro.

- **Dark only** — a sleek true-black theme with hairline borders.
- **Hebrew supported everywhere** — Rubik covers Latin + Hebrew, and content uses
  automatic direction (`dir="auto"`), so Hebrew posts render right-to-left while
  the UI stays left-to-right.
- **Plain text** posts (no Markdown); line breaks are preserved.
- **Author byline** on every post; the editor remembers the last author you
  used in this browser (cookie-based, per person — not site-wide).

## Stack
- **Next.js 15** (App Router, React 19, TypeScript)
- **MongoDB** storage (native `mongodb` driver)
- **Rubik** + **JetBrains Mono** via `next/font`

## Setup & run

Requires a running MongoDB instance (local or Atlas). Set `MONGODB_URI` if it
isn't on the default `mongodb://localhost:27017`.

```bash
npm install
npm run seed     # optional: a few sample posts
npm run dev      # http://localhost:3000
```

Desk: <http://localhost:3000/admin/login> — default password `admin`
(**change it** before any real use).

Production:

```bash
npm run build
npm start
```

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | `admin` | Password for the desk |
| `SECRET_KEY` | `dev-secret-change-me` | Signs the session cookie |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `rssfeed` | Database name |
| `SITE_TITLE` | `RSSFeed` | Site / feed title |
| `SITE_DESCRIPTION` | `A modern news feed with RSS, Atom and JSON.` | Tagline / feed description |
| `SITE_URL` | `http://localhost:3000` | Public base URL (used in feed + permalink links) |
| `SITE_AUTHOR` | `RSSFeed` | Default feed author |

Set `SITE_URL` to the real public URL in production so feed/permalink links
resolve for consumers.

## Feed URLs
- RSS 2.0 — `/feed/rss.xml`
- Atom 1.0 — `/feed/atom.xml`
- JSON Feed — `/feed/feed.json`

Feeds include only published posts, carry the author (`dc:creator` / Atom
`author` / JSON `authors`), and send `Access-Control-Allow-Origin: *` so
browser-side fetchers (e.g. Grafana's News panel) can read them.

## Project layout

```
app/            # pages, feed route handlers, admin actions
components/      # SiteHeader, SiteFooter, Editor, FeedChannels, Icon
lib/            # config, db, repository, markdown (plain-text renderer), feeds, auth, format
scripts/seed.mjs
```

The previous Flask implementation is preserved in `legacy-flask/`.
