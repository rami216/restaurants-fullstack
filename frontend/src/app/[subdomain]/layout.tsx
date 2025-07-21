// frontend/src/app/[subdomain]/layout.tsx

import React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css"; // UPDATED: Import global styles

// --- NEW: Add the same font setup as your main layout ---
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function SubdomainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // --- UPDATED: Add html and body tags with the correct fonts ---
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
