import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { fmt, links } from "@/lib/format";
import { data, download } from "@/lib/site";

export const metadata: Metadata = { title: "Downloads" };

export default function Downloads() {
    const { site, models } = data();
    const r = site.release;
    return (
        <>
            <Crumb left="Downloads" right={r ? r.tag : "CAD release pending"} />
            <div className="px-4 pb-20 sm:px-6">
                <h1 className="cond border-b-2 border-ink py-8 text-[88px] leading-[0.85]">Downloads</h1>
                {r ? (
                    <section className="grid gap-6 border-b-2 border-ink py-6 lg:grid-cols-12">
                        <div className="lg:col-span-5">
                            <div className="tag">Latest CAD release · built by CI from OpenSCAD sources</div>
                            <a className="cond mt-2 block text-[34px] leading-none underline decoration-2 underline-offset-4" target="_blank" rel="noreferrer" href={r.url}>
                                {r.tag}
                            </a>
                            <p className="mt-3 max-w-[52ch] text-[13px] leading-snug">
                                Every link below was checked against the release&apos;s SHA256SUMS.txt when this site was built.{" "}
                                {r.missingOutputs.length ? (
                                    <>
                                        <b>{r.missingOutputs.length} registered outputs are not in this release</b>; they link to the committed booklet pack that contains them, or are marked unpublished.
                                    </>
                                ) : (
                                    "All registered outputs are in this release."
                                )}
                            </p>
                        </div>
                        <div className="grid self-start border-t border-l border-ink sm:grid-cols-2 lg:col-span-7">
                            {r.booklets.map((b) => (
                                <a key={b.name} href={b.url} className="border-r border-b border-ink p-4 hover:bg-sheet">
                                    <div className="font-semibold break-words">{b.name}</div>
                                    {/^ARBI-camera-pod-bench-(assembly|STL)/.test(b.name) && <div className="tag mt-1">Dry bench alternative · archived model configuration</div>}
                                    <div className="tag mt-1 text-grey">SHA-256 {b.sha256.slice(0, 16)}…</div>
                                </a>
                            ))}
                        </div>
                    </section>
                ) : (
                    <p className="tag border-b-2 border-ink py-4">A CAD release matching these sources is pending. Only current source-checked packs are offered as model downloads.</p>
                )}
                <h2 className="cond mt-10 text-[34px]">Archived committed snapshots</h2>
                <p className="mt-2 text-[13px]">Historical PDFs and packs may contain earlier designs. Use the current CAD release above for assembly and fabrication.</p>
                <div className="mt-3 grid border-t border-l border-ink md:grid-cols-2 xl:grid-cols-3">
                    {site.snapshots.map((f) => (
                        <a key={f.path} href={f.url} className="flex gap-5 border-r border-b border-ink p-5 hover:bg-sheet">
                            <div className="cond w-[78px] shrink-0 text-[40px] leading-none">{fmt.ext(f.name)}</div>
                            <div className="min-w-0">
                                <div className="font-semibold break-words">{f.name}</div>
                                <div className="tag mt-1 text-grey">
                                    {f.kind} · {fmt.bytes(f.bytes)}
                                </div>
                                <div className="tag truncate text-grey">{f.path.split("/").slice(0, -1).join("/")}</div>
                            </div>
                        </a>
                    ))}
                </div>
                <h2 className="cond mt-14 text-[34px]">Model files</h2>
                <table className="mt-3 w-full border-t-2 border-ink text-[13px]">
                    <thead>
                        <tr className="tag border-b border-ink text-left">
                            <th className="py-2">Model</th>
                            <th className="hidden md:table-cell">Assembly</th>
                            <th>Rev</th>
                            <th className="hidden lg:table-cell">SHA-256</th>
                            <th className="text-right">Files</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map((m) => {
                            const dl = download(m.id);
                            return (
                                <tr key={m.id} className="border-b border-hair">
                                    <td className="py-1.5">
                                        <Link href={`/parts/${m.id}`} className="hover:underline">
                                            {m.id}
                                        </Link>
                                        {m.geometry && <div className="mt-1 text-xs text-grey">Approximate visualization · needs rework · not for fabrication</div>}
                                    </td>
                                    <td className="tag hidden md:table-cell">{m.assembly}</td>
                                    <td className="mono">{m.revision}</td>
                                    <td className="mono hidden text-[11px] text-grey lg:table-cell">{dl.sha256 ? `${dl.sha256.slice(0, 12)}…` : dl.label}</td>
                                    <td className="text-right whitespace-nowrap">
                                        {dl.verified ? (
                                            <a className="tag underline" href={dl.url}>
                                                {dl.sha256 ? fmt.ext(m.output) : "pack"}
                                            </a>
                                        ) : (
                                            <span className="tag text-grey">—</span>
                                        )}{" "}
                                        ·{" "}
                                        <a className="tag underline" target="_blank" rel="noreferrer" href={links.raw(m.entrypoint)}>
                                            scad
                                        </a>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
