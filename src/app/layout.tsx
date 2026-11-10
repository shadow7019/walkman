import type { Metadata, Viewport } from "next";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Walkman — Free Hi-Fi Music Streaming",
  description:
    "Walkman is a free music streaming app with lossless-quality playback and universal playlist import: bring your playlists from Spotify, Apple Music, YouTube Music and more.",
  keywords: ["Walkman", "music streaming", "playlist import", "hi-fi audio", "free music app"],
  applicationName: "Walkman",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Walkman",
  },
  openGraph: {
    title: "Walkman — Free Hi-Fi Music Streaming",
    description: "Stream in lossless quality for free and import playlists from any music app.",
    siteName: "Walkman",
    type: "website",
    images: [{ url: "/logo-full.png", width: 1254, height: 1254, alt: "Walkman — Minimal Walkman Wave Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Walkman — Free Hi-Fi Music Streaming",
    description: "Stream in lossless quality for free and import playlists from any music app.",
    images: ["/logo-full.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
