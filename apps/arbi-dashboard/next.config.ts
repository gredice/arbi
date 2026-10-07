import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, serverExternalPackages: ["pg", "@arbi/protocol", "@arbi/gredice"] };
export default config;
