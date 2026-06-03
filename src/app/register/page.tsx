"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="container-app flex justify-center py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="text-4xl">🔒</span>
        <h1 className="mt-4 text-xl font-bold">הרשמה סגורה</h1>
        <p className="mt-2 text-sm text-slate-600">
          פתיחת חשבונות סוחרים מתבצעת על ידי צוות A.M.S GROUP בלבד.
          <br />
          לפרטים צרו קשר עם היבואן.
        </p>
        <Link href="/login" className="btn-primary mt-6 inline-flex">
          כניסה לחשבון קיים
        </Link>
      </div>
    </div>
  );
}
