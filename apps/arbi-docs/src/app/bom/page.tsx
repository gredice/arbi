import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { fmt } from "@/lib/format";
import { data } from "@/lib/site";

export const metadata: Metadata = { title: "Bill of materials" };

export default function Bom() {
    const { site } = data();
    const sum = site.bom.summary;
    const groups = Map.groupBy(site.bom.parts, (p) => p.usedIn[0]?.assemblyId ?? "not in v1 build");
    const head: [string, string][] = [
        [fmt.eur(sum.knownSubtotal), "Known partial subtotal"],
        ["Unavailable", "Complete landed total"],
        [fmt.eur(sum.knownGoodsSubtotal), "Known goods"],
        [String(sum.warningCount), "Open warnings"],
    ];
    return (
        <>
            <Crumb left="Bill of materials" right={sum.scenarioId} />
            <div className="px-4 pb-20 sm:px-6">
                <section className="grid gap-6 border-b-2 border-ink py-8 lg:grid-cols-12">
                    <h1 className="cond text-[88px] leading-[0.85] lg:col-span-6">
                        Bill of
                        <br />
                        materials
                    </h1>
                    <div className="grid grid-cols-2 self-end border-t-2 border-ink lg:col-span-6">
                        {head.map(([n, l], i) => (
                            <div key={l} className={`border-b border-ink py-3 ${i % 2 ? "border-l pl-4" : ""}`}>
                                <div className="cond text-[34px] leading-none">{n}</div>
                                <div className="tag mt-1">{l}</div>
                            </div>
                        ))}
                    </div>
                </section>
                <p className="tag border-b border-ink py-3">
                    Status: {sum.complete ? "complete" : "incomplete"} · {sum.destinationName} · quote {sum.quoteSnapshotId} · null values are never treated as zero
                </p>
                {[...groups].map(([group, list]) => (
                    <section key={group} className="mt-10">
                        <div className="flex items-end justify-between">
                            <h2 className="cond text-[30px] leading-none">{site.bom.assemblies.find((a) => a.id === group)?.name ?? group}</h2>
                            <span className="tag">
                                {list.length} items · {fmt.eur(sum.assemblyKnownGoods.find((x) => x.assemblyId === group)?.amount)}
                            </span>
                        </div>
                        <table className="mt-3 w-full border-t-2 border-ink text-[13px]">
                            <thead>
                                <tr className="tag border-b border-ink text-left">
                                    <th className="w-10 py-2">#</th>
                                    <th>Item</th>
                                    <th className="text-right">Qty</th>
                                    <th className="hidden pl-6 md:table-cell">Supplier</th>
                                    <th className="hidden md:table-cell">Qualification</th>
                                    <th className="text-right">Known</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((p, i) => (
                                    <tr key={p.id} className="border-b border-hair hover:bg-sheet">
                                        <td className="mono py-2">{fmt.pad(i + 1)}</td>
                                        <td>
                                            <Link href={`/bom/${p.id}`} className="hover:underline">
                                                {p.name}
                                            </Link>
                                        </td>
                                        <td className="mono text-right">
                                            {p.required ?? "—"}
                                            {p.unit === "each" ? "" : ` ${p.unit}`}
                                        </td>
                                        <td className="tag hidden pl-6 md:table-cell">{p.supplierId ?? "—"}</td>
                                        <td className="tag hidden md:table-cell">{fmt.status(p.qualification ?? "no offer")}</td>
                                        <td className="mono text-right">{p.bundle ? "bundle" : p.knownGoods ? fmt.eur(p.knownGoods) : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                ))}
            </div>
        </>
    );
}
