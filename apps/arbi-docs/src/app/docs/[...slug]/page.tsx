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
                <article className="prose-doc lg:col-span-9" dangerouslySetInnerHTML={{ __html: renderMarkdown(path) }} />
            </div>
        </>
    );
}
