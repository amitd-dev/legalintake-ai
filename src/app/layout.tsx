import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hartwell & Vance LLP — Speak with our team",
  description: "24/7 client intake. Describe your legal matter and book a consultation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
