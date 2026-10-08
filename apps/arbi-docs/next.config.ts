import type { NextConfig } from "next";

const config: NextConfig = {
    poweredByHeader: false,
    async redirects() {
        // Retired single-page and direction-mockup URLs.
        return [
            { source: "/parts/payload-assembly", destination: "/parts/camera-pod-assembly", permanent: true },
            ...["/a", "/b", "/c", "/d", "/mockups/:path*", "/site/:path*"].map((source) => ({ source, destination: "/", permanent: false })),
        ];
    },
};

export default config;
