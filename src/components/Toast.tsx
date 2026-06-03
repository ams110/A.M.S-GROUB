"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; msg: string; type: ToastType };

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const add = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++counter.current;
    setList((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setList((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4 print:hidden">
        {list.map((t) => (
          <div
            key={t.id}
            className={`toast-enter pointer-events-auto rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
              t.type === "success"
                ? "bg-emerald-600"
                : t.type === "error"
                ? "bg-rose-600"
                : "bg-slate-700"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
