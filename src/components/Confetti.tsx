"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight CSS confetti burst — no dependency, no canvas.
 * Renders a one-shot shower of gold/onyx pieces. Mount it (e.g. on a success
 * screen) and it animates once. Respects prefers-reduced-motion via CSS.
 */
const COLORS = ["#E0BE45", "#C9A227", "#FBF1CF", "#9C7C18", "#F5F0E4"];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
};

export default function Confetti({ count = 70 }: { count?: number }) {
  // Randomness lives in an effect (post-mount) to keep render pure.
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.6 + Math.random() * 1.4,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 160,
      }))
    );
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-[-12px]"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 0.6}px`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--rot" as string]: `${p.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
