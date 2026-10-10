import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { HashRedirect } from "@/components/HashRedirect";
import { MobileNavigation } from "@/components/MobileNavigation";
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
            <body className="flex min-h-dvh flex-col">
                <HashRedirect />
                <header className="sticky top-0 z-40 shrink-0 border-b-2 border-ink bg-paper text-ink">
                    <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
                        <Link href="/" className="shrink-0">
                            <img src={`${BRAND}/arbi-logo.svg`} alt="ARBI" className="h-10 w-auto" />
                        </Link>
                        <span className="tag hidden text-grey lg:inline">Automatic Raised Bed Imaging · open engineering manual</span>
                        <nav aria-label="Main navigation" className="tag ml-auto hidden gap-5 md:flex">
                            {NAV.map(([href, label]) => (
                                <Link key={href} href={href} className="hover:underline">
                                    {label}
                                </Link>
                            ))}
                        </nav>
                        <MobileNavigation items={NAV} />
                    </div>
                </header>
                <main className="flex-1">{children}</main>
                <footer className="tag flex shrink-0 flex-wrap items-center gap-x-8 gap-y-4 bg-ink px-4 py-6 text-paper sm:px-6">
                    <img src={`${BRAND}/arbi-logo.svg`} alt="ARBI" className="h-12 w-auto brightness-0 invert" />
                    <span>
                        Source{" "}
                        <a className="underline" href={links.commit(site.commit)} target="_blank" rel="noreferrer">
                            {site.commit.slice(0, 12)}
                        </a>{" "}
                        · {site.commitDate}
                    </span>
                    <span>AGPL-3.0-only</span>
                    <span>Compiled from the repository</span>
                    <a className="ml-auto underline" href={GITHUB} target="_blank" rel="noreferrer">
                        github.com/gredice/arbi
                    </a>
                    <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-paper/30 pt-4">
                        <a href="https://www.gredice.com" className="flex items-center gap-3" target="_blank" rel="noreferrer">
                            <span>Powered by</span>
                            <img src={`${BRAND}/gredice-logo-white.svg`} alt="Gredice" className="h-8 w-auto" />
                        </a>
                        <div className="flex items-center gap-2">
                            <img src={`${BRAND}/flag-hr.svg`} alt="Croatia" width={24} height={18} />
                            <img src={`${BRAND}/flag-eu.svg`} alt="European Union" width={24} height={18} />
                            <span>With love from Croatia.</span>
                        </div>
                    </div>
                </footer>
            </body>
        </html>
    );
}
