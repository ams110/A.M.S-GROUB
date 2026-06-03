import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Â.M.Ŝ GROUP — פורטל הזמנות",
  description: "פורטל הזמנות סיטונאי של Â.M.Ŝ GROUP — מצלמות, מקליטים ובקרת כניסה.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="manifest" href={`${basePath}/manifest.json`} />
        <meta name="theme-color" content="#0D1B36" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AMS Group" />
        <link rel="apple-touch-icon" href={`${basePath}/logo.svg`} />
      </head>
      <body>
        <CartProvider>
          <ToastProvider>
            <Header />
            <main className="min-h-[calc(100vh-4rem)] pb-16 md:pb-0">{children}</main>
            <footer className="border-t border-navy/10 bg-navy-dark py-6 text-center text-sm text-white/40 print:hidden">
              <div className="container-app">
                Â.M.Ŝ GROUP — פורטל סיטונאי ליבואן הרשמי · © {new Date().getFullYear()}
              </div>
            </footer>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
