"use client";

/**
 * Camera barcode / QR scanner — a self-contained modal.
 *
 * Uses the browser's native BarcodeDetector (Chrome / Android / Edge) over a
 * live camera stream — zero external dependencies, works inside the installed
 * PWA. When the API or camera isn't available it degrades gracefully to a
 * manual code entry box, so the feature never dead-ends. On a successful scan
 * it vibrates, stops the camera and hands the raw code to `onDetect`.
 */

import { useEffect, useRef, useState } from "react";
import { SCAN_FORMATS } from "@/lib/barcode";
import Portal from "@/components/Portal";

// The native API isn't in TS's lib yet; describe just what we use.
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (opts?: { formats?: readonly string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export default function BarcodeScanner({
  onDetect,
  onClose,
  title = "סריקת מוצר",
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;

    const stop = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
        setError("המכשיר אינו תומך בסריקה ישירה — הקלידו את הקוד ידנית.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setScanning(true);

        const detector = new Ctor({ formats: SCAN_FORMATS as unknown as string[] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const code = found[0]?.rawValue?.trim();
            if (code) {
              try {
                navigator.vibrate?.(60);
              } catch {
                /* vibration is best-effort */
              }
              stop();
              onDetect(code);
              return;
            }
          } catch {
            /* transient decode error — keep scanning */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError("לא ניתן לגשת למצלמה. אשרו הרשאה או הקלידו ידנית.");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onDetect]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (code) onDetect(code);
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="card w-full max-w-sm overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-bold text-navy-dark">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 text-2xl leading-none text-slate-400 hover:text-slate-600"
            aria-label="סגירה"
          >
            ×
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {scanning && !error && (
            <>
              {/* Reticle */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-2/3 w-2/3 rounded-2xl border-2 border-gold-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90">
                כוונו את הברקוד למסגרת
              </div>
            </>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
              {error}
            </div>
          )}
        </div>

        <form onSubmit={submitManual} className="flex gap-2 p-4">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="או הקלידו מק״ט / ברקוד…"
            className="input min-w-0 flex-1"
            inputMode="text"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={!manual.trim()}>
            חפש
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
}
