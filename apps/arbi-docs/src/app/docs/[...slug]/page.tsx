import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumb } from "@/components/Crumb";
import { links } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { data, docBySlug, docHref, docTitle } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
    return Object.keys(data().docTexts)
        .map((path) => docHref(path))
        .filter((href): href is string => Boolean(href && href.startsWith("/docs/")))
        .map((href) => ({ slug: href.slice("/docs/".length).split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
    const path = docBySlug((await params).slug);
    return { title: path ? docTitle(path) : "Document" };
}

export default async function Doc({ params }: { params: Promise<{ slug: string[] }> }) {
    const path = docBySlug((await params).slug);
    if (!path) notFound();
    const booklet = path.match(/^docs\/assemblies\/(camera-pod|winch|dock)\/booklet\//)?.[1];
    const release = data().site.release;
    const currentBooklets = booklet ? release?.booklets.filter((b) => b.name.startsWith(booklet === "camera-pod" ? "ARBI-camera-pod-" : `ARBI-${booklet}-`)) ?? [] : [];
    return (
        <>
            <Crumb left={`Documents / ${path}`} />
            <div className="grid gap-8 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-12">
                <aside className="grid gap-2 self-start lg:sticky lg:top-24 lg:col-span-3">
                    <Link className="key-line justify-between" href="/docs">
                        All documents <span>←</span>
                    </Link>
                    <a className="key-line justify-between" target="_blank" rel="noreferrer" href={links.source(path)}>
                        GitHub <span>↗</span>
                    </a>
                    <a className="key justify-between" href={links.raw(path)}>
                        Markdown <span>↓</span>
                    </a>
                </aside>
                <div className="lg:col-span-9">
                    {booklet ? (
                        <section className="mb-8 border-2 border-ink p-5">
                            <h2 className="cond text-[34px]">Current assembly guides</h2>
                            <p className="mt-2 text-[13px]">{currentBooklets.length ? `${release!.tag} · current PDFs and STL/source packs` : "The current guides are being prepared."} The publication notes below explain the artifact and evidence status.</p>
                            <div className="mt-4 grid gap-2">
                                {currentBooklets.map((b) => (
                                    <a key={b.name} className="key-line break-words" href={b.url}>{b.name} ↓</a>
                                ))}
                                <Link className="key-line" href="/downloads">All current downloads →</Link>
                            </div>
                        </section>
                    ) : null}
                    <article className="prose-doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(path) }} />
                </div>
            </div>
        </>
    );
}
