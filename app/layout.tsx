import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "弘光科技大學 | 社團指導老師教學紀錄系統",
  description: "課外活動指導組 - 指導老師輔導時數與紀錄管理平台",
  openGraph: {
    title: "弘光科技大學 | 社團指導老師教學紀錄系統",
    description: "課外活動指導組 - 指導老師輔導時數與紀錄管理平台",
    url: "https://hk-activity-records.vercel.app/",
    siteName: "弘光科大社團紀錄系統",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
