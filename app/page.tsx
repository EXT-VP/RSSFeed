import { Fragment } from "react";

import AutoRefresh from "@/components/AutoRefresh";
import FeedChannels from "@/components/FeedChannels";
import Icon from "@/components/Icon";
import NewsTicker from "@/components/NewsTicker";
import LocalTime from "@/components/LocalTime";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { config, feedUrls } from "@/lib/config";
import NewBadge from "@/components/NewBadge";
import {
  dayKey,
  dayLabel,
  excerptFromHtml,
  labelChipStyle,
  labelStyle,
  parseLabels,
} from "@/lib/format";
import {
  ensureLabelColors,
  feedVersion,
  getLabelColors,
  listLabels,
  listPublished,
  type NewsItem,
} from "@/lib/repository";

export const dynamic = "force-dynamic";

function thumbStyle(id: string) {
  // Deterministic hue from the id string so each post keeps a stable color.
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 45) % 360} 60% 28%))`,
  };
}

type Props = {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    label?: string;
    page?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const sort = sp.sort === "oldest" ? "oldest" : "newest";
  const label = (sp.label ?? "").trim();
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filtering = Boolean(q || from || to || label);

  const urls = feedUrls();
  const version = await feedVersion();
  const allLabels = await listLabels();
  await ensureLabelColors(allLabels); // backfill colors for any pre-existing labels
  const labelColors = await getLabelColors();
  let items = await listPublished(); // newest first

  if (q) {
    const needle = q.toLowerCase();
    items = items.filter((i) =>
      `${i.title} ${i.body_markdown} ${i.author} ${i.label}`
        .toLowerCase()
        .includes(needle),
    );
  }
  if (label) {
    items = items.filter((i) => parseLabels(i.label).includes(label));
  }
  if (from) {
    items = items.filter(
      (i) => (i.published_at ?? i.created_at).slice(0, 10) >= from,
    );
  }
  if (to) {
    items = items.filter(
      (i) => (i.published_at ?? i.created_at).slice(0, 10) <= to,
    );
  }
  if (sort === "oldest") items = [...items].reverse();

  // Build feed URLs that keep the current search/date/sort while changing label.
  const labelHref = (lbl: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sort === "oldest") params.set("sort", sort);
    if (lbl) params.set("label", lbl);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  // Page link that preserves the current search/date/sort/label.
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sort === "oldest") params.set("sort", sort);
    if (label) params.set("label", label);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  // Paginate the filtered list.
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(pageNum, totalPages);
  const pageItems = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Group by day, preserving order.
  const groups: { key: string; label: string; items: NewsItem[] }[] = [];
  for (const item of pageItems) {
    const iso = item.published_at ?? item.created_at;
    const k = dayKey(iso);
    let group = groups[groups.length - 1];
    if (!group || group.key !== k) {
      group = { key: k, label: dayLabel(iso), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="shell">
      <AutoRefresh version={version} />
      <SiteHeader />
      <NewsTicker />
      <main className="main">
        <div className="page">
          {allLabels.length > 0 && (
            <nav className="label-filters" aria-label="Filter by label">
              <a
                className={`label-chip${label ? "" : " is-active"}`}
                href={labelHref("")}
              >
                All
              </a>
              {allLabels.map((lbl) => (
                <a
                  key={lbl}
                  className={`label-chip${label === lbl ? " is-active" : ""}`}
                  href={labelHref(lbl)}
                  style={label === lbl ? undefined : labelChipStyle(labelColors[lbl])}
                  dir="auto"
                >
                  {lbl}
                </a>
              ))}
            </nav>
          )}

          <form className="controls" method="get">
            {label && <input type="hidden" name="label" value={label} />}
            <input
              className="field-search"
              type="search"
              name="q"
              placeholder="Search posts…"
              defaultValue={q}
              aria-label="Search posts"
            />
            <input
              type="date"
              name="from"
              defaultValue={from}
              aria-label="From date"
              title="From date"
            />
            <span className="controls-range-sep">–</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              aria-label="To date"
              title="To date"
            />
            <select name="sort" defaultValue={sort} aria-label="Sort by date">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button className="btn btn-tonal" type="submit">
              Search
            </button>
            {filtering && (
              <a className="controls-clear" href="/">
                Clear
              </a>
            )}
          </form>

          <div className="feed">
            {items.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="inbox" />
                </div>
                <div className="empty-title">
                  {filtering ? "No posts found" : "No stories yet"}
                </div>
                <p className="empty-note">
                  {filtering
                    ? "Try a different search or date."
                    : "Published stories will appear here."}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <Fragment key={group.key}>
                  <div className="feed-day label">{group.label}</div>
                  {group.items.map((item, i) => {
                    const iso = item.published_at ?? item.created_at;
                    const tags = parseLabels(item.label);
                    return (
                      <a
                        key={item.id}
                        className="feed-item"
                        href={`/news/${item.id}`}
                        style={{
                          animationDelay: `${Math.min(i, 10) * 45}ms`,
                        }}
                      >
                        <span
                          className="feed-thumb"
                          style={thumbStyle(item.id)}
                          aria-hidden="true"
                        >
                          {item.title.trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="feed-body">
                          <div className="feed-source">
                            <span dir="auto">
                              {item.author || config.siteTitle}
                            </span>
                            <span className="sep">·</span>
                            <LocalTime iso={iso} mode="relative" />
                            <NewBadge iso={iso} />
                            {item.priority === "high" && (
                              <span className="prio prio-high">Important</span>
                            )}
                            {tags.length > 0 && (
                              <span className="feed-tags">
                                {tags.map((l) => (
                                  <span
                                    key={l}
                                    className="tag"
                                    style={labelStyle(labelColors[l])}
                                    dir="auto"
                                  >
                                    {l}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <div className="feed-title" dir="auto">
                            {item.title}
                          </div>
                          <div className="feed-snippet" dir="auto">
                            {excerptFromHtml(item.body_html, 160)}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </Fragment>
              ))
            )}

            {totalPages > 1 && (
              <nav className="pager" aria-label="Pagination">
                {currentPage > 1 ? (
                  <a className="btn btn-tonal" href={pageHref(currentPage - 1)}>
                    Previous
                  </a>
                ) : (
                  <span className="btn btn-tonal is-disabled" aria-disabled="true">
                    Previous
                  </span>
                )}
                <span className="pager-status">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <a className="btn btn-tonal" href={pageHref(currentPage + 1)}>
                    Next
                  </a>
                ) : (
                  <span className="btn btn-tonal is-disabled" aria-disabled="true">
                    Next
                  </span>
                )}
              </nav>
            )}

            <FeedChannels rss={urls.rss} atom={urls.atom} json={urls.json} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
