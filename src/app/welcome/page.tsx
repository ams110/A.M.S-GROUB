"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/auth";

export default function WelcomePage() {
  const router = useRouter();
  const { profile, email, ready } = useProfile();
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

  const dest = profile?.role === "admin" || profile?.role === "super_admin" ? "/admin" : "/products";
  const displayName =
    profile?.company || profile?.full_name || email?.split("@")[0] || "";

  useEffect(() => {
    if (!ready) return;
    if (!email) {
      router.replace("/");
      return;
    }

    const t1 = setTimeout(() => setPhase("show"), 80);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(() => router.replace(dest), 2700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [ready, email, dest, router]);

  return (
    <div
      className="welcome-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0C0B0A 0%, #1C1A17 55%, #0C0B0A 100%)",
        opacity: phase === "exit" ? 0 : 1,
        transition: phase === "exit" ? "opacity 0.5s ease-in" : "none",
      }}
    >
      {/* Floating orbs background */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[
          { size: 400, top: "-10%", left: "-8%", delay: "0s", dur: "8s" },
          { size: 300, top: "60%", right: "-5%", delay: "1.5s", dur: "10s" },
          { size: 200, top: "20%", right: "15%", delay: "0.8s", dur: "7s" },
          { size: 150, top: "70%", left: "10%", delay: "2s", dur: "9s" },
          { size: 100, top: "40%", left: "40%", delay: "3s", dur: "6s" },
        ].map((orb, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0) 70%)",
              top: orb.top,
              left: (orb as any).left,
              right: (orb as any).right,
              animation: `floatOrb ${orb.dur} ${orb.delay} ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Subtle gold hairline accents */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(201,162,39,0.35), transparent)",
          transform: "translateY(-120px)",
          opacity: phase === "show" ? 1 : 0,
          transition: "opacity 1s 0.3s ease",
        }}
      />

      {/* Main content */}
      <div
        style={{
          textAlign: "center",
          color: "#fff",
          padding: "2rem",
          transform: phase === "show" ? "translateY(0)" : "translateY(30px)",
          opacity: phase === "show" ? 1 : 0,
          transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.8s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo ring */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 120,
              height: 120,
            }}
          >
            {/* Pulsing ring */}
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)",
                animation: "ringPulse 2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: -18,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                animation: "ringPulse 2s 0.4s ease-in-out infinite",
              }}
            />
            {/* Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg`}
              alt="Â.M.Ŝ GROUP"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "24px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 50px rgba(201,162,39,0.35)",
                animation: "logoBounce 0.8s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            />
          </div>
        </div>

        {/* Company name */}
        <h1
          style={{
            fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
            fontWeight: 800,
            letterSpacing: "0.04em",
            marginBottom: "0.5rem",
            textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            animation: "slideUp 0.8s 0.2s both cubic-bezier(0.34,1.2,0.64,1)",
          }}
        >
          Â.M.Ŝ GROUP
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: "0.95rem",
            color: "rgba(201,162,39,0.85)",
            marginBottom: "2.5rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
            animation: "slideUp 0.8s 0.35s both",
          }}
        >
          פורטל הזמנות סיטונאי
        </p>

        {/* Welcome message */}
        <div
          style={{
            animation: "slideUp 0.8s 0.5s both",
          }}
        >
          <p
            style={{
              fontSize: "1.15rem",
              color: "rgba(255,255,255,0.85)",
              marginBottom: "0.4rem",
            }}
          >
            ברוכים הבאים 👋
          </p>
          {displayName && (
            <p
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 0 30px rgba(255,255,255,0.3)",
              }}
            >
              {displayName}
            </p>
          )}
        </div>

        {/* Loading dots */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "3rem",
            animation: "slideUp 0.8s 0.7s both",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.6)",
                animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes floatOrb {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(20px, -30px) scale(1.05); }
        }
        @keyframes twinkle {
          from { opacity: 0.2; transform: scale(0.8); }
          to   { opacity: 1;   transform: scale(1.3); }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.08); opacity: 0.2; }
        }
        @keyframes logoBounce {
          from { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          to   { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0);    opacity: 0.4; }
          50%       { transform: translateY(-10px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
