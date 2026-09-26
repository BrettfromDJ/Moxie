import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { StoreProvider } from "@/lib/store";
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
  title: "Moxie — write posts that sound like you",
  description:
    "Turn rough thoughts, drafts, and sources into posts for X that sound like you. Find stronger angles, explore proven structures, and teach it your voice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <StoreProvider>
          <Sidebar>{children}</Sidebar>
        </StoreProvider>
      </body>
    </html>
  );
}
