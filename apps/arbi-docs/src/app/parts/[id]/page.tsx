import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Crumb } from "@/components/Crumb";
import { PartViewer } from "@/components/PartViewer";
import { fmt, links } from "@/lib/format";
import { bomForModel, data, docHref, download, figureFor, installedCount, meshFor, partColor, systemBySlug } from "@/lib/site";
import type { Vec3 } from "@/lib/types";

export const dynamicParams = false;
export const generateStaticParams = () => data().models.map((m) => ({ id: m.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const m = data().modelById.get((await params).id);
    return { title: m?.id, description: m?.description };
}

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
    const m = data().modelById.get((await params).id);
    if (!m) notFound();
    const sys = systemBySlug(m.assembly);
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
                            <figcaption className="tag mt-2 w-full self-start">Booklet drawing</figcaption>
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
