import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "A.M.S GROUP — פורטל הזמנות",
  description: "פורטל הזמנות סיטונאי של A.M.S GROUP — מצלמות, מקליטים ובקרת כניסה.",
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
          <ToastProvider>
          <Header />
          <main className="min-h-[calc(100vh-4rem)] pb-16 md:pb-0">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500 print:hidden">
            <div className="container-app">
              A.M.S GROUP — פורטל סיטונאי ליבואן הרשמי · © {new Date().getFullYear()}
            </div>
          </footer>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
