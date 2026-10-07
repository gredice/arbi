import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { links } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { data, docHref } from "@/lib/site";

export const metadata: Metadata = { title: "Documents" };

export default function Docs() {
    const { site } = data();
    const groups = Map.groupBy(site.docs, (d) => d.section);
    return (
        <>
            <Crumb left="Documents" right={`${site.docs.length} files`} />
            <div className="px-4 pb-20 sm:px-6">
                <section className="grid gap-8 border-b-2 border-ink py-8 lg:grid-cols-12">
                    <aside className="grid gap-2 self-start lg:sticky lg:top-24 lg:col-span-3">
                        <a className="key-line justify-between" target="_blank" rel="noreferrer" href={links.source("docs/README.md")}>
                            GitHub <span>↗</span>
                        </a>
                    </aside>
                    <article className="prose-doc lg:col-span-9" dangerouslySetInnerHTML={{ __html: renderMarkdown("docs/README.md") }} />
                </section>
                <h2 className="cond mt-10 text-[40px] leading-none">All documents</h2>
                {[...groups].map(([section, docs]) => (
                    <section key={section} className="grid gap-4 border-b border-ink py-6 md:grid-cols-12">
                        <h3 className="cond text-[28px] leading-none md:col-span-3">{section}</h3>
                        <div className="grid gap-x-8 md:col-span-9 md:grid-cols-2">
                            {docs.map((d) => (
                                <Link key={d.path} href={docHref(d.path) ?? "/docs"} className="block border-b border-hair py-2 hover:bg-sheet">
                                    <div className="font-semibold">{d.title}</div>
                                    <div className="line-clamp-2 text-[12.5px] text-grey">{d.summary}</div>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}
