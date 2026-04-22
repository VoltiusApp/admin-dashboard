import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voltius Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-950 text-gray-100 font-mono">
        {children}
      </body>
    </html>
  );
}
