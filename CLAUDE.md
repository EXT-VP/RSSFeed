# CLAUDE.md — RSSFeed

Project-specific notes for Claude. Read this first; it captures architecture and
gotchas that aren't obvious from a quick scan. (User-facing docs live in `README.md`.)

## What this is

A small internal **news feed** app. Signed-in editors ("the desk") write posts;
every published post is rendered as a public web feed **and** syndicated as
**RSS 2.0**, **Atom 1.0**, and **JSON Feed** for consumers like Grafana's News
panel and Confluence's RSS macro. Dark-only theme, Hebrew/RTL supported.

## Stack

- **Next.js 15** App Router + **React 19** + **TypeScript** (strict).
- **MongoDB** via the native `mongodb` driver (migrated off SQLite — leftover
  `news.db*` files in the repo root are dead and can be ignored/removed).
- Fonts: **Rubik** (Latin + Hebrew) and **JetBrains Mono** via `next/font`.
- The previous Python implementation is archived in `legacy-flask/` — do not edit
  it for app changes.

## Architecture & data flow

- **All pages are React Server Components** rendering on every request
  (`export const dynamic = "force-dynamic"` on `app/page.tsx` and
  `app/news/[id]/page.tsx`). They `await` repository functions directly — there
  is no API layer for page data.
- The **only** client components are the few interactive widgets:
  `components/LocalTime.tsx`, `components/Editor.tsx`,
  `components/FeedChannels.tsx`, `components/AutoRefresh.tsx`, and
  `components/NewBadge.tsx`.
- **Mutations** go through Server Actions in `app/admin/actions.ts` (`"use server"`),
  which call the repository and then `revalidatePath("/")` + `revalidatePath("/admin")`.
- **DB access** is centralized in `lib/repository.ts`. `lib/db.ts` caches the
  Mongo connection promise on `globalThis` (survives dev hot-reload) and creates
  the `{ status: 1, published_at: -1 }` index on `news_item`. A **rejected**
  connect is deliberately NOT cached (dropped in a `.catch`) so requests retry —
  otherwise one failed boot-order race (app up before Mongo) poisons every
  request until restart.

## Data model (`lib/repository.ts`)

- `NewsItem`: `id` (string form of Mongo `_id`), `title`, `body_markdown` (raw
  text as typed), `body_html` (rendered), `author`, `label` (comma-separated
  string), `priority` (`low|normal|high`), `status` (`draft|published`),
  `created_at`, `updated_at`, `published_at` (ISO strings; `published_at` set on
  first publish).
- Collections: `news_item` and `label_color`. `label_color` remembers a random
  `hue` per label (keyed by the label text) so each label keeps a stable color;
  `ensureLabelColors` upserts with `$setOnInsert` (never overwrites).
- `listPublished(limit?)` is newest-first. Syndication feeds are capped to the 15
  newest items; the web feed lists all and paginates client-side at 10/page.

## Conventions / gotchas

- **Body rendering is plain text, not Markdown** despite the filename
  `lib/markdown.ts` and the `marked` dependency. `renderBody` escapes HTML and
  turns blank lines into `<p>` and single newlines into `<br>`. **`marked` and
  `sanitize-html` are in `package.json` but currently unused** — don't assume
  Markdown works.
- **Time handling is split deliberately**: server/feed formatting in `lib/format.ts`
  is **UTC**; on-screen timestamps render in the **viewer's local TZ** via the
  client `LocalTime` component. Keep new user-facing times going through `LocalTime`.
- **"New" badge is self-expiring**: window is 10h (`RECENT_WINDOW_MS` in
  `lib/format.ts`); `components/NewBadge.tsx` (client) hides itself via a
  `setTimeout` at the exact expiry moment — the badge must NOT be rendered by a
  server-only `isRecent()` check, or it lingers until a manual refresh
  (auto-refresh only fires on data changes, not time passing).
- **Hebrew/RTL**: user content uses `dir="auto"`; the UI chrome stays LTR. Preserve
  `dir="auto"` on any element that shows title/author/label/body.
- **Auth** (`lib/auth.ts`): a single shared `ADMIN_PASSWORD`, checked with
  `timingSafeEqual`; session is an HMAC cookie (`wire_session`). `requireAuth()`
  guards every Server Action.
- **Author prefill is per-browser, not site-wide** (`lib/author.ts`): saving a
  post stores the author in a `wire_author` cookie (URI-encoded — authors can be
  Hebrew; 1-year, httpOnly); `/admin/new` prefills from it via `recallAuthor()`.
  The old DB-wide `lastAuthor()` in the repository was removed on purpose —
  don't reintroduce a global "whoever posted last" prefill.
- **Styling**: one global stylesheet `app/globals.css` with CSS custom properties
  (true-black surfaces, hairline borders). No CSS framework, no CSS modules. Match
  the existing token vocabulary (`--surface-*`, `--primary`, `--accent`, `--rss`,
  `--r-*` radii). All animations must stay under the existing
  `@media (prefers-reduced-motion: reduce)` kill-switch at the bottom of the file.
- **Label colors** are applied inline via `labelStyle` / `labelChipStyle` in
  `lib/format.ts` using the remembered hue — not via CSS classes.

## Live auto-refresh (feed stays fresh across machines)

- `lib/repository.ts → feedVersion()` returns a cheap fingerprint of the published
  feed: `"<count>:<max updated_at>"`. It changes on any add/edit/delete/unpublish.
- `app/api/feed-version/route.ts` (force-dynamic, `no-store`) exposes it as JSON.
- `components/AutoRefresh.tsx` (mounted in `app/page.tsx`) polls that endpoint every
  15s — pausing while the tab is hidden, re-checking on focus/visibility — and calls
  `router.refresh()` when the version changes. Existing DOM reconciles in place
  (scroll preserved); only new items animate in. A gradient "New stories" toast
  (`.live-toast`) flashes on update.
- The page passes its server-computed `feedVersion()` as the `version` prop so the
  client baseline matches the rendered content exactly.

## UI animation

- **Aurora background**: three blurred colored blobs (`.aurora` markup in
  `app/layout.tsx`, styles in `globals.css`) sit at `z-index:0` behind `.shell`
  (`z-index:1`). Uses the brand palette (indigo `#5865f2`, teal `#7de3da`, orange
  `#ff9a52`) at low opacity — deliberately subtle, not a generic rainbow. The glow
  is **static (no animation)** on purpose: a drifting blurred layer competed with
  the ticker for GPU frames and caused scroll jank. Don't re-add aurora `animation`
  without re-checking ticker smoothness.
- **Feed items** fade/slide in with a per-item stagger (`animation-delay` set inline
  in `app/page.tsx`, `item-in` keyframes). Uses `backwards` fill (not `forwards`) so
  hover/active transforms keep working after entry.
- **News ticker**: a scrolling headline bar under the nav on the home and article
  pages. `components/NewsTicker.tsx` (server) lists the 5 most recent published posts
  (`listPublished(5)`) and renders the "Latest" label; `components/TickerMarquee.tsx`
  (client) does the scrolling. The marquee renders the headlines as one "group",
  measures it + the viewport (ResizeObserver), repeats the group enough times to
  always overflow the viewport (so **never any empty space**), and shifts the track by
  exactly one group width per loop — seamless because every group is identical.
  The scroll is a **Web Animations API transform** (`track.animate(...)`), NOT a
  CSS keyframe animation, **on purpose**: Windows often ships "Animation effects"
  off → `prefers-reduced-motion: reduce` → the global `animation: none !important`
  kill-switch would freeze a CSS ticker. WAAPI is still compositor-driven (smooth,
  off main thread) but immune to that media query — the ticker is live content, so
  it deliberately keeps scrolling under reduced motion. Consequently hover-pause is
  JS too (`anim.pause()/play()` on viewport mouseenter/leave), since CSS
  `animation-play-state` can't touch a WAAPI animation. Constant px/s speed, edges
  masked. Returns null when there's no news; updates via auto-refresh.

## Commands

```bash
npm run dev      # localhost:3000 (needs MongoDB; set MONGODB_URI if not default)
npm run seed     # sample posts
npm run build && npm start
npx tsc --noEmit # typecheck (no test suite in the Next app)
```

Desk login: `/admin/login` (default password `admin`). Config is all env vars —
see the table in `README.md`.

## Build & deploy

- **Dockerfile**: 2-stage build on `node:20-alpine`, using Next.js **standalone
  output** (`output: "standalone"` in `next.config.mjs`). Builder (`npm ci` +
  `npm run build`) → runner copies only `.next/standalone` (minimal server + traced
  node_modules) and `.next/static`, runs `node server.js` as user `node`,
  `HOSTNAME=0.0.0.0`, exposes 3000. Image is **~242MB** (was ~650MB). Two things keep
  it down, do NOT undo them: (1) standalone output (drops the ~140MB build-only SWC
  binaries + full `next`/`typescript`); (2) `outputFileTracingExcludes` strips
  Sharp's `@img` (~33MB) and `typescript` since the app uses plain `<img>`, never
  `next/image` — if you ever add `next/image`, remove the `@img`/`sharp` excludes.
  `MONGODB_URI` is supplied at runtime; a `HEALTHCHECK` fetches `/`.
- **CI** (`.github/workflows/on-tag.yml`): on pushing a `v*` tag, builds the image,
  exports it as a `.tar`, attaches it to a GitHub Release, and uploads it to
  `s3://y.packages/rssfeed/`. No image registry push — distribution is via the tar.
  No test/lint CI step exists.

## Routes

- `/` feed · `/news/[id]` article · `/admin` desk · `/admin/new`, `/admin/[id]/edit`,
  `/admin/login`
- `/feed/rss.xml`, `/feed/atom.xml`, `/feed/feed.json` (built by `lib/feeds.ts`;
  CORS `*`; `[!]`-prefix titles for high-priority items)
- `/api/feed-version` (internal, for auto-refresh polling)
