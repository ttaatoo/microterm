import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Menubar Terminal",
  description: "A terminal in your macOS menubar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
