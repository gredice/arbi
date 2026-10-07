import type { NextConfig } from "next";

const config: NextConfig = {
    poweredByHeader: false,
    async rewrites() {
        // The site is a static, client-routed page; its data is compiled into public/site/data at build time.
        return { beforeFiles: [{ source: "/", destination: "/site/index.html" }], afterFiles: [], fallback: [] };
    },
    async redirects() {
        // Retired direction-mockup URLs.
        return ["/a", "/b", "/c", "/d", "/mockups/:path*"].map((source) => ({ source, destination: "/", permanent: false }));
    },
};

export default config;
