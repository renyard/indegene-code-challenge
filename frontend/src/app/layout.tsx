import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@copilotkit/react-ui/v2/styles.css";
import "./globals.css";
import { FlyonInit } from "@/components/FlyonInit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recipe Assistant",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FlyonInit />
        {children}
      </body>
    </html>
  );
}
