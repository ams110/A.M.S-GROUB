"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  buildImportLines,
  type ColumnMap,
  type ImportLine,
  type ImportRow,
} from "@/lib/importPO";
import type { Product, Supplier } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import Portal from "@/components/Portal";

/**
 * Import a purchase order from an Excel/CSV file: upload → map columns →
 * preview matches → confirm. On confirm it hands the parent matched lines
 * (+ chosen supplier) to pre-fill the PO wizard.
 */
export default function PurchaseOrderImport({
  products,
  suppliers,
  onClose,
  onConfirm,
}: {
  products: Product[];
  suppliers: Supplier[];
  onClose: () => void;
  onConfirm: (lines: { product_id: string; qty: number; unit_cost: number }[], supplierId: string) => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [map, setMap] = useState<ColumnMap>({ match: "", matchBy: "auto", cost: "", qty: "" });
  const [supplierId, setSupplierId] = useState("");

  const onFile = async (file: File) => {
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
      if (json.length === 0) {
        setError("הקובץ ריק או ללא כותרות.");
        return;
      }
      const cols = Object.keys(json[0]);
      setRows(json);
      setColumns(cols);
      setFileName(file.name);
      // Best-effort auto-guess of the columns by common header names.
      const guess = (cands: string[]) =>
        cols.find((c) => cands.some((k) => c.toLowerCase().includes(k))) ?? "";
      setMap({
        match: guess(["sku", "מק", "barcode", "ברקוד", "name", "שם", "product", "מוצר"]) || cols[0],
        matchBy: "auto",
        cost: guess(["cost", "עלות", "price", "מחיר", "תקלcost"]) || "",
        qty: guess(["qty", "quantity", "כמות"]) || "",
      });
    } catch {
      setError("קריאת הקובץ נכשלה. נסו קובץ .xlsx או .csv תקין.");
    }
  };

  const result = useMemo(() => {
    if (!map.match || !map.cost || rows.length === 0) return null;
    return buildImportLines(rows, map, products);
  }, [rows, map, products]);

  const canConfirm = !!result && result.matchedCount > 0;

  const confirm = () => {
    if (!result) return;
    const lines = result.lines
      .filter((l) => l.matched)
      .map((l) => ({ product_id: l.product_id, qty: l.qty, unit_cost: l.unit_cost }));
    onConfirm(lines, supplierId);
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">ייבוא הזמנת רכש מאקסל</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-600" aria-label="סגירה">
            ✕
          </button>
        </div>

        {/* Step 1 — file */}
        <div className="rounded-2xl border border-dashed border-gold/40 bg-gold-50/40 p-4 text-center">
          <input
            id="po-import-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <label htmlFor="po-import-file" className="btn-gold inline-flex cursor-pointer">
            📄 בחירת קובץ (xlsx / csv)
          </label>
          {fileName && (
            <p className="mt-2 text-sm text-slate-600">
              {fileName} · {rows.length} שורות
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            עמודות מומלצות: שם מוצר / מק״ט / ברקוד · עלות · כמות
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {columns.length > 0 && (
          <>
            {/* Step 2 — supplier + mapping */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">ספק</label>
                <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">— ללא —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">זיהוי מוצר לפי</label>
                <select
                  className="input"
                  value={map.matchBy}
                  onChange={(e) => setMap((m) => ({ ...m, matchBy: e.target.value as ColumnMap["matchBy"] }))}
                >
                  <option value="auto">אוטומטי (מק״ט/ברקוד/שם)</option>
                  <option value="sku">מק״ט</option>
                  <option value="barcode">ברקוד</option>
                  <option value="name">שם מוצר</option>
                </select>
              </div>
              <MapSelect label="עמודת זיהוי" value={map.match} columns={columns} onChange={(v) => setMap((m) => ({ ...m, match: v }))} />
              <MapSelect label="עמודת עלות" value={map.cost} columns={columns} onChange={(v) => setMap((m) => ({ ...m, cost: v }))} />
              <MapSelect label="עמודת כמות (לא חובה)" value={map.qty ?? ""} columns={columns} onChange={(v) => setMap((m) => ({ ...m, qty: v }))} allowNone />
            </div>

            {/* Step 3 — preview */}
            {result && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                    {result.matchedCount} זוהו
                  </span>
                  {result.unmatchedCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
                      {result.unmatchedCount} לא זוהו
                    </span>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-2">מוצר</th>
                        <th className="p-2">כמות</th>
                        <th className="p-2">עלות</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lines.map((l: ImportLine, i) => (
                        <tr key={i} className={`border-t border-slate-100 ${l.matched ? "" : "bg-rose-50/50"}`}>
                          <td className="p-2">{l.name_he}</td>
                          <td className="p-2">{l.qty}</td>
                          <td className="p-2">{formatPrice(l.unit_cost)}</td>
                          <td className="p-2">
                            {l.matched ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="text-rose-500" title="לא נמצא מוצר תואם">✕</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.unmatchedCount > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    שורות שלא זוהו לא ייכללו. בדקו שהמק״ט/ברקוד תואמים לקטלוג.
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button onClick={onClose} className="btn-outline">
                ביטול
              </button>
              <button onClick={confirm} disabled={!canConfirm} className="btn-gold">
                המשך לטופס ({result?.matchedCount ?? 0}) ←
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}

function MapSelect({
  label,
  value,
  columns,
  onChange,
  allowNone,
}: {
  label: string;
  value: string;
  columns: string[];
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">— ללא —</option>}
        {!allowNone && <option value="">— בחרו עמודה —</option>}
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
