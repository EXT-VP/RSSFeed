"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; title: string };

const SPEED = 40; // px per second — constant regardless of how much content

/**
 * Seamless, gap-free marquee. The headlines are rendered as one "group", then
 * repeated enough times to always overflow the viewport (so there's never empty
 * space), and the track is shifted left by exactly one group width per loop —
 * because every group is identical, the reset is invisible. Re-measures on
 * resize and whenever the headline set changes.
 *
 * The scroll is driven by the Web Animations API, NOT a CSS animation, on
 * purpose: Windows ships "Animation effects" off in many setups, which flips
 * `prefers-reduced-motion: reduce`, and the global kill-switch in globals.css
 * (`animation: none !important`) would freeze a CSS-keyframe ticker. WAAPI
 * transforms still run on the compositor (same smoothness, off the main
 * thread) but aren't touched by that media query. The ticker is live content,
 * not decoration, so it deliberately keeps moving under reduced motion.
 */
export default function TickerMarquee({ items }: { items: Item[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [groupW, setGroupW] = useState(0);
  const [repeat, setRepeat] = useState(2);

  useEffect(() => {
    const measure = () => {
      const vp = viewportRef.current;
      const grp = groupRef.current;
      if (!vp || !grp) return;
      // Fractional width (not scrollWidth, which rounds to an integer) so the
      // per-loop shift lands exactly on the next identical group — an integer
      // shift leaves a sub-pixel gap that pops on every wrap and reads as lag.
      const gw = grp.getBoundingClientRect().width;
      if (gw === 0) return;
      setGroupW(gw);
      // Enough groups so the viewport stays covered even at the loop's end:
      // need total width >= viewport + one group.
      setRepeat(Math.max(2, Math.ceil(vp.clientWidth / gw) + 1));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (groupRef.current) ro.observe(groupRef.current);
    return () => ro.disconnect();
  }, [items]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || groupW === 0) return;
    const anim = track.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: `translate3d(${-groupW}px, 0, 0)` },
      ],
      {
        duration: (groupW / SPEED) * 1000,
        iterations: Infinity,
        easing: "linear",
      },
    );
    animRef.current = anim;
    return () => {
      animRef.current = null;
      anim.cancel();
    };
  }, [groupW]);

  const pieces = (decorative: boolean) =>
    items.map((item) => (
      <span className="ticker-piece" key={item.id}>
        <a
          className="ticker-title"
          href={`/news/${item.id}`}
          dir="auto"
          tabIndex={decorative ? -1 : undefined}
          aria-hidden={decorative || undefined}
        >
          {item.title}
        </a>
        <span className="ticker-dot" aria-hidden="true">
          ·
        </span>
      </span>
    ));

  // Pause on hover in JS — the CSS `animation-play-state` trick only works on
  // CSS animations, and this one is WAAPI-driven.
  const pause = () => animRef.current?.pause();
  const resume = () => animRef.current?.play();

  return (
    <div
      className="ticker-viewport"
      ref={viewportRef}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="ticker-track" ref={trackRef}>
        <div className="ticker-group" ref={groupRef}>
          {pieces(false)}
        </div>
        {Array.from({ length: Math.max(1, repeat - 1) }).map((_, i) => (
          <div className="ticker-group" key={i} aria-hidden="true">
            {pieces(true)}
          </div>
        ))}
      </div>
    </div>
  );
}
