import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { HashRedirect } from "@/components/HashRedirect";
import { GITHUB, links } from "@/lib/format";
import { data } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

// Brand assets are compiled from docs/assets/brand; usage follows docs/project/brand-identity.md.
const BRAND = "/data/docs/assets/brand";

export const metadata: Metadata = {
    title: { default: "ARBI — Automatic Raised Bed Imaging", template: "%s — ARBI" },
    description:
        "Open engineering site for ARBI, a four-cable outdoor camera robot. Every drawing, part, number and document is compiled from the gredice/arbi repository.",
    icons: { icon: `${BRAND}/arbi-mark-transparent.png` },
};

const NAV = [
    ["/systems", "Systems"],
    ["/parts", "Parts"],
    ["/bom", "BOM"],
    ["/docs", "Docs"],
    ["/downloads", "Downloads"],
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
    const { site } = data();
    return (
        <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
            <body>
                <HashRedirect />
                <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper text-ink">
                    <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
                        <Link href="/" className="shrink-0">
                            {/* Transparent logo on a light header. */}
                            <img src={`${BRAND}/arbi-logo-transparent.png`} alt="ARBI" className="h-10 w-auto" />
                        </Link>
                        <span className="tag hidden text-grey lg:inline">Automatic Raised Bed Imaging · open engineering manual</span>
                        <nav className="tag ml-auto flex gap-5 overflow-x-auto">
                            {NAV.map(([href, label]) => (
                                <Link key={href} href={href} className="hover:underline">
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </header>
                <main>{children}</main>
                <footer className="tag flex flex-wrap items-center gap-x-8 gap-y-3 bg-ink px-4 py-6 text-paper sm:px-6">
                    {/* Primary (warm-white panel) logo on a dark background. */}
                    <img src={`${BRAND}/arbi-logo.png`} alt="ARBI" className="h-12 w-auto" />
                    <span>
                        Source{" "}
                        <a className="underline" href={links.commit(site.commit)} target="_blank" rel="noreferrer">
                            {site.commit.slice(0, 12)}
                        </a>{" "}
                        · {site.commitDate}
                    </span>
                    <span>AGPL-3.0-only</span>
                    <span>Compiled from the repository · no website-only content</span>
                    <a className="ml-auto underline" href={GITHUB} target="_blank" rel="noreferrer">
                        github.com/gredice/arbi
                    </a>
                </footer>
            </body>
        </html>
    );
}
