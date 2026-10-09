import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Crumb } from "@/components/Crumb";
import { CatalogPart } from "@/components/CatalogPart";
import { PartViewer } from "@/components/PartViewer";
import { fmt, links } from "@/lib/format";
import { bomForModel, data, docHref, download, figureFor, installedCount, meshFor, partColor, systemBySlug } from "@/lib/site";
import type { Vec3 } from "@/lib/types";

export const dynamicParams = false;
export const generateStaticParams = () => [...new Set([...data().parts, ...data().archivedModels].map((part) => part.id))].map((id) => ({ id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const id = (await params).id;
    const part = data().bomById.get(id);
    const m = data().modelById.get(id);
    return { title: part?.name ?? m?.id, description: part?.requirements.join(" ") ?? m?.description };
}

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
    const id = (await params).id;
    const part = data().bomById.get(id);
    if (part) return <CatalogPart part={part} />;
    const m = data().modelById.get(id);
    if (!m) notFound();
    if (m.archiveReason) return (
        <>
            <Crumb left={`Archived parts / ${m.id}`} right="Archived · do not print for current assembly" />
            <section className="px-4 py-8 sm:px-6">
                <h1 className="cond text-[44px] leading-none">{m.id}</h1>
                <p className="mt-4 max-w-[70ch]">{m.archiveReason}</p>
                <p className="mt-3">Revision {m.revision} · {fmt.status(m.status)}. Excluded from the current BOM, installed quantities and model downloads.</p>
                <div className="mt-6">
                    <div className="tag">Current replacements</div>
                    {m.supersededBy?.length ? m.supersededBy.map((id) => (
                        <Link key={id} href={`/parts/${id}`} className="mt-2 block underline">{id} →</Link>
                    )) : <p className="mt-2">No qualified replacement is recorded; see the assembly documentation for unresolved interfaces.</p>}
                </div>
                {m.alternativeConfiguration && <p className="mt-6">Retained in the explicit dry bench alternative booklet. Use the integrated enclosure kit for the current pod.</p>}
                <a href={links.source(m.entrypoint)} target="_blank" rel="noreferrer" className="mt-6 block underline">Historical SCAD source</a>
                <Link href="/parts/archive" className="mt-6 block underline">← Archived models</Link>
            </section>
        </>
    );
    const sys = systemBySlug(data().instances.get(m.id)?.scene ?? m.assembly);
    const count = installedCount(m.id);
    const bom = bomForModel(m);
    const fig = figureFor(m.id);
    const dl = download(m.id);
    const doc = docHref(m.documentation);
    const rows: [string, ReactNode][] = [
        ["Status", fmt.status(m.status)],
        ["Role", m.artifactRole],
        ["Revision", m.revision],
        ["Output", <span className="mono">{m.output}</span>],
        [
            "BOM item",
            bom.length
                ? bom.map((b) => (
                      <Link key={b.id} className="block underline" href={`/bom/${b.id}`}>
                          {b.name}
                      </Link>
                  ))
                : "Reference artifact",
        ],
        [
            "Source",
            <a className="mono break-all underline" target="_blank" rel="noreferrer" href={links.source(m.entrypoint)}>
                {m.entrypoint}
            </a>,
        ],
        [
            "Document",
            doc ? (
                <Link className="underline" href={doc}>
                    {m.documentation.split("/").slice(-2).join("/")}
                </Link>
            ) : (
                m.documentation
            ),
        ],
    ];
    return (
        <>
            <Crumb left={`${sys?.number ?? "—"} · ${sys?.name ?? m.assembly} / ${m.id}`} right={`Rev ${m.revision}`} />
            <section className="grid border-b-2 border-ink lg:grid-cols-12">
                <div className="lg:col-span-7">
                    <PartViewer
                        mesh={meshFor(m.id)}
                        model={m.id}
                        color={partColor(m.id) as Vec3}
                        output={m.output}
                        missing={m.output.endsWith(".csg") ? "CSG reference assembly · open the system view for its meshes" : "No mesh in the CAD release or booklet packs"}
                    />
                </div>
                <div className="flex flex-col px-4 py-6 sm:px-6 lg:col-span-5">
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="cond text-[44px] leading-[0.9] break-words">{m.id.replace(/-/g, "‑")}</h1>
                        <div className="shrink-0 text-right">
                            <div className="cond text-[72px] leading-[0.8]">{count ? `${count}×` : "—"}</div>
                            <div className="tag mt-1">installed</div>
                        </div>
                    </div>
                    <p className="mt-4 text-[15px] leading-snug">{m.description}</p>
                    <table className="mt-6 w-full border-t-2 border-ink text-[13px]">
                        <tbody>
                            {rows.map(([k, v]) => (
                                <tr key={k} className="border-b border-ink">
                                    <td className="tag w-[110px] py-2 pr-4 align-top">{k}</td>
                                    <td className="py-2">{v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        <a className={`${dl.verified ? "key" : "key-line pointer-events-none opacity-50"} justify-between`} href={dl.url}>
                            {fmt.ext(m.output)} <span>↓</span>
                        </a>
                        <a className="key-line justify-between" target="_blank" rel="noreferrer" href={links.raw(m.entrypoint)}>
                            SCAD <span>↓</span>
                        </a>
                    </div>
                    <p className="tag mt-2 break-all text-grey">{dl.sha256 ? `${dl.label} · SHA-256 ${dl.sha256.slice(0, 16)}…` : dl.label}</p>
                    {fig && (
                        <figure className="mt-6 grid place-items-center border border-ink p-4">
                            <img src={fig} alt="" className="max-h-[180px]" />
                            <figcaption className="tag mt-2 w-full self-start">CAD figure</figcaption>
                        </figure>
                    )}
                </div>
            </section>
            {sys && (
                <section className="mt-10 mb-20 px-4 sm:px-6">
                    <Link href={`/systems/${sys.slug}`} className="key-line justify-between">
                        ← Back to {sys.name} exploded view
                    </Link>
                </section>
            )}
        </>
    );
}
