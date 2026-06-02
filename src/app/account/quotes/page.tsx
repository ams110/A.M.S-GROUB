"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth";
import { formatPrice, QUOTE_STATUS_HE } from "@/lib/format";
import type { Quote, QuoteItem } from "@/lib/types";

export default function MyQuotesPage() {
  const router = useRouter();
  const { ready, userId } = useProfile();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !userId) router.replace("/login?redirect=/account/quotes");
  }, [ready, userId, router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });
      const list = (qs as Quote[]) ?? [];
      setQuotes(list);

      if (list.length) {
        const { data: its } = await supabase
          .from("quote_items")
          .select("quote_id,line_total")
          .in(
            "quote_id",
            list.map((q) => q.id)
          );
        const t: Record<string, number> = {};
        for (const it of (its ?? []) as { quote_id: string; line_total: number }[]) {
          t[it.quote_id] = (t[it.quote_id] ?? 0) + Number(it.line_total);
        }
        setTotals(t);
      }
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="container-app py-10">
      <h1 className="mb-4 text-2xl font-bold">הצעות המחיר שלי</h1>

      {loading ? (
        <div className="card p-10 text-center text-slate-500">טוען…</div>
      ) : quotes.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">אין הצעות מחיר.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3">מס׳</th>
                <th className="p-3">תאריך</th>
                <th className="p-3">בתוקף עד</th>
                <th className="p-3">סכום</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-slate-100">
                  <td className="p-3 font-mono">{q.quote_number}</td>
                  <td className="p-3">
                    {new Date(q.created_at).toLocaleDateString("he-IL")}
                  </td>
                  <td className="p-3">
                    {q.valid_until
                      ? new Date(q.valid_until).toLocaleDateString("he-IL")
                      : "—"}
                  </td>
                  <td className="p-3 font-bold text-brand-dark">
                    {formatPrice(totals[q.id] ?? 0)}
                  </td>
                  <td className="p-3">
                    <span className="badge bg-slate-100 text-slate-700">
                      {QUOTE_STATUS_HE[q.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link href={`/quote?id=${q.id}`} className="text-brand hover:underline">
                      צפייה / הדפסה
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
