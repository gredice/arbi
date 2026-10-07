export const GITHUB = "https://github.com/gredice/arbi";

export const fmt = {
    eur: (v: string | number | null | undefined) =>
        v == null ? "unknown" : `€${Number(v).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    bytes: (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`),
    pad: (n: number, w = 2) => String(n).padStart(w, "0"),
    status: (s: string | null | undefined) =>
        ({
            "concept-unvalidated": "Concept · unvalidated",
            "baseline-selected": "Baseline selected",
            unresolved: "Unresolved",
            approved: "Approved",
            candidate: "Candidate",
        })[s ?? ""] ?? s ?? "—",
    ext: (file: string) => file.split(".").pop() ?? "",
};

export const links = {
    source: (path: string) => `${GITHUB}/blob/main/${path}`,
    raw: (path: string) => `${GITHUB}/raw/main/${path}`,
    commit: (sha: string) => `${GITHUB}/commit/${sha}`,
    releases: `${GITHUB}/releases`,
};
