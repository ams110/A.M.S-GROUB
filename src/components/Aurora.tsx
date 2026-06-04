"use client";

import { useEffect, useRef } from "react";

/**
 * Animated "Aurora Gold" backdrop — drifting gold particles linked into a
 * living constellation over a slow aurora glow. Pure canvas, no deps.
 * Absolutely fills its positioned parent; respects prefers-reduced-motion.
 */
export default function Aurora({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0, raf = 0;

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    let pts: P[] = [];

    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(16, Math.min(48, Math.floor((w * h) / 13000)));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.6,
        a: Math.random() * 0.5 + 0.3,
      }));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() / 1000;

      // Slow aurora glows
      for (let i = 0; i < 3; i++) {
        const gx = w * (0.3 + 0.45 * Math.sin(t * 0.14 + i * 2.1));
        const gy = h * (0.5 + 0.5 * Math.cos(t * 0.11 + i * 1.6));
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.45);
        g.addColorStop(0, "rgba(201,162,39,0.06)");
        g.addColorStop(1, "rgba(201,162,39,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Constellation links
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d < 116) {
            ctx.strokeStyle = `rgba(212,175,55,${0.13 * (1 - d / 116)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      // Particles
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(230,194,78,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />;
}
