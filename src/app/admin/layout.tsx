import Link from "next/link";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getSessionContext();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-bold">אין הרשאה</h1>
        <p className="mt-2 text-slate-500">אזור זה מיועד למנהלי המערכת בלבד.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          חזרה
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <h1 className="ml-4 text-xl font-bold">ניהול</h1>
        <nav className="flex gap-1 text-sm">
          <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
            סקירה
          </Link>
          <Link href="/admin/orders" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
            הזמנות
          </Link>
          <Link href="/admin/dealers" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
            סוחרים
          </Link>
          <Link href="/admin/products" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">
            מוצרים ומחירים
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
