import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Unsaid — Before you wed. Check Unsaid.",
  description:
    "Privately answer the questions couples often avoid. Unsaid compares what both of you actually expect from marriage and finds the differences worth talking about—before they become surprises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/invite/continue"
      signUpFallbackRedirectUrl="/invite/continue"
    >
      <html lang="en">
        <body className={`${newsreader.variable} ${inter.variable} antialiased`}>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
