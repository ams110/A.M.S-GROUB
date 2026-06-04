import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import AuthGuard from "@/components/AuthGuard";
import { ToastProvider } from "@/components/Toast";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
  display: "swap",
});

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
    <html lang="he" dir="rtl" className={heebo.variable}>
      <head>
        <link rel="manifest" href={`${basePath}/manifest.json`} />
        <meta name="theme-color" content="#0C0B0A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AMS Group" />
        <link rel="apple-touch-icon" sizes="180x180" href={`${basePath}/icon-180.png`} />
      </head>
      <body>
        <CartProvider>
          <ToastProvider>
            <AuthGuard>{children}</AuthGuard>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
