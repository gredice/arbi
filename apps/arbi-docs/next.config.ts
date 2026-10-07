import type { NextConfig } from "next";

const config: NextConfig = {
    poweredByHeader: false,
    async redirects() {
        return [
            { source: "/a", destination: "/mockups/a-index.html", permanent: false },
            { source: "/b", destination: "/mockups/b-studio.html", permanent: false },
            { source: "/c", destination: "/mockups/c-manual.html", permanent: false },
            { source: "/d", destination: "/mockups/d-manual-ink.html", permanent: false },
        ];
    },
};

export default config;
