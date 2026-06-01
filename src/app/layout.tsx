import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Tiandy סוחרים — פורטל הזמנות",
  description: "פורטל הזמנות סיטונאי למוצרי Tiandy — מצלמות, מקליטים ובקרת כניסה.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <CartProvider>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
            <div className="container-app">
              Tiandy סוחרים — פורטל סיטונאי ליבואן הרשמי · © {new Date().getFullYear()}
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
