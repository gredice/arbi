import type { NextConfig } from "next";
import aliases from "../../hardware/model-aliases.json";

const config: NextConfig = {
    poweredByHeader: false,
    async redirects() {
        // Retired single-page and direction-mockup URLs.
        return [
            { source: "/systems/positioning-lines", destination: "/systems/corner-station", permanent: true },
            ...Object.entries(aliases).map(([previous, current]) => ({ source: `/parts/${previous}`, destination: `/parts/${current}`, permanent: true })),
            { source: "/docs/hardware/assemblies/camera-pod/payload-:name", destination: "/docs/hardware/assemblies/camera-pod/camera-pod-:name", permanent: true },
            { source: "/docs/decisions/0009-compact-integrated-payload", destination: "/docs/decisions/0009-compact-integrated-camera-pod", permanent: true },
            ...["/a", "/b", "/c", "/d", "/mockups/:path*", "/site/:path*"].map((source) => ({ source, destination: "/", permanent: false })),
        ];
    },
};

export default config;
