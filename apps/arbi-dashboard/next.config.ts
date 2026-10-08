import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@arbi/protocol", "@arbi/gredice", "@arbi/simulation-core", "@arbi/audit"],
  webpack(config, { isServer }) {
    // Next's node_modules opt-out does not match pnpm workspace symlink targets.
    // Keep Node filesystem/schema consumers native, including in Server Components.
    // Native import also works with serverless loaders that reject require(ESM).
    if (isServer) config.externals.push(({ request }: { request?: string }, callback: (error: Error | null, result?: string) => void) => {
      if (request && ["@arbi/protocol", "@arbi/gredice", "@arbi/simulation-core", "@arbi/audit"].includes(request)) callback(null, `import ${request}`);
      else callback(null);
    });
    return config;
  },
};
export default config;
