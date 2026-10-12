import type { Metadata } from "next";
import Link from "next/link";
import { Crumb } from "@/components/Crumb";
import { data } from "@/lib/site";

export const metadata: Metadata = { title: "Archived parts and models" };

export default function ArchivedParts() {
    const { archivedModels, site } = data();
    return (
        <>
            <Crumb left="Parts / Archive" right={`${site.bom.archivedParts.length} historical BOM items · ${archivedModels.length} historical models`} />
            <section className="px-4 py-8 sm:px-6">
                <h1 className="cond text-[44px]">Archived parts and models</h1>
                <p className="mt-3 max-w-[70ch]">These sources preserve design history and explicit alternative configurations. They are excluded from the current BOM, assembly quantities and individual fabrication downloads.</p>
                <h2 className="cond mt-8 text-[30px]">Historical BOM items</h2>
                <ul className="mt-3 border-t-2 border-ink">
                    {site.bom.archivedParts.map((part) => (
                        <li key={part.id} className="border-b border-ink py-4">
                            <Link href={`/parts/${part.id}`} className="underline">{part.name}</Link>
                            <Link href={`/bom/${part.id}`} className="tag ml-4 underline">Historical BOM</Link>
                        </li>
                    ))}
                </ul>
                <h2 className="cond mt-8 text-[30px]">Historical CAD models</h2>
                <ul className="mt-6 border-t-2 border-ink">
                    {archivedModels.map((m) => (
                        <li key={m.id} className="border-b border-ink py-4">
                            <Link href={`/parts/${m.id}`} className="mono underline">{m.id} · r{m.revision}</Link>
                            <p className="mt-2 text-[13px]">{m.archiveReason}</p>
                        </li>
                    ))}
                </ul>
            </section>
        </>
    );
}
