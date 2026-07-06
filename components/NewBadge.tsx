"use client";

import { useEffect, useState } from "react";

import { isRecent, RECENT_WINDOW_MS } from "@/lib/format";

/**
 * "New" chip that removes itself the moment the post ages out of the
 * recent window — no page refresh needed. Server renders it for recent
 * posts; a client-side timer hides it exactly at expiry.
 */
export default function NewBadge({ iso }: { iso: string }) {
  const [visible, setVisible] = useState(() => isRecent(iso));

  useEffect(() => {
    const remaining = new Date(iso).getTime() + RECENT_WINDOW_MS - Date.now();
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const id = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(id);
  }, [iso]);

  if (!visible) return null;
  return <span className="feed-new">New</span>;
}
