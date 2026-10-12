import Link from "next/link";
import type { BomWarning } from "@/lib/types";
import { warningCounts } from "@/lib/warnings";

const priorities = ["critical", "warning"] as const;
const labels = { critical: "Critical", warning: "Warning" };
const styles = { critical: "border-red-800 bg-red-50 text-red-900", warning: "border-amber-700 bg-amber-50 text-amber-900" };

export function WarningBadges({ warnings = [], counts = warningCounts(warnings) }: { warnings?: BomWarning[]; counts?: { critical: number; warning: number } }) {
    return <span className="mt-2 flex flex-wrap gap-2">{priorities.map((severity) => {
        const count = counts[severity];
        return count > 0 && <span key={severity} className={`tag border px-2 py-1 text-[10px] ${styles[severity]}`}>{labels[severity]} · {count}</span>;
    })}</span>;
}

export function WarningList({ warnings, linkTo }: { warnings: BomWarning[]; linkTo?: "parts" | "bom" }) {
    if (warnings.length === 0) return null;
    return <div className="mt-4 space-y-3">{priorities.map((severity) => {
        const list = warnings.filter((warning) => warning.severity === severity);
        if (list.length === 0) return null;
        return <details key={severity} open={severity === "critical" && !linkTo} className={`border p-3 ${styles[severity]}`}>
            <summary className="cursor-pointer font-semibold">{labels[severity]} · {list.length}</summary>
            <ul className="mt-3 list-disc space-y-3 pl-5 text-sm">{list.map((warning) => <li key={JSON.stringify([warning.code, warning.message, warning.partIds])}>
                <span>{warning.message}</span>
                {linkTo && warning.partIds.length > 0 && <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{warning.partIds.map((id) =>
                    <Link key={id} href={`/${linkTo}/${id}`} className="underline">{id}</Link>)}</span>}
            </li>)}</ul>
        </details>;
    })}</div>;
}

export function WarningOverview({ warnings, linkTo }: { warnings: BomWarning[]; linkTo: "parts" | "bom" }) {
    return <section className="my-6" aria-label="Warning priorities">
        <h2 className="cond text-[30px]">Work to resolve</h2>
        <p className="mt-2 max-w-4xl text-sm"><strong>Critical:</strong> temporary workarounds, missing specifications or procurement information. Cable ties are temporary workarounds only and must be replaced for the final assembly. <strong>Warning:</strong> concepts, approximate geometry or selections awaiting confirmation.</p>
        <WarningList warnings={warnings} linkTo={linkTo} />
    </section>;
}
