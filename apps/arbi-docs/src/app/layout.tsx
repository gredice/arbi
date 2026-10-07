import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
    title: "ARBI — Automatic Raised Bed Imaging",
    description: "Open engineering site for ARBI, a four-cable outdoor camera robot. All content is compiled from the gredice/arbi repository.",
    // Brand assets are compiled from docs/assets/brand by scripts/compile-data.mjs.
    icons: { icon: "/mockups/data/docs/assets/brand/arbi-mark-transparent.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono&display=swap" rel="stylesheet" />
            </head>
            <body>{children}</body>
        </html>
    );
}
