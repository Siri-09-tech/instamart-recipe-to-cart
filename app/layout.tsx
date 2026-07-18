import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe-to-Cart · Instamart",
  description:
    "Paste a recipe, match ingredients on Instamart, and fill your cart via Swiggy MCP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
