import { execFileSync } from 'node:child_process';
import type { NextConfig } from "next";
let revision:string|null=null,dirty:boolean|null=null;
try{const value=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:2000}).trim();if(/^[a-f0-9]{40}$/.test(value)){revision=value;dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8',timeout:2000}).length>0;}}catch{ /* Build identity stays unavailable without a readable repository. */ }
const webIdentity=JSON.stringify({revision,dirty,builtAt:new Date().toISOString(),environment:process.env.VERCEL_ENV==='production'?'production':process.env.VERCEL_ENV==='preview'?'preview':'local',provenance:'web-build-manifest'});
const config: NextConfig = {
  env:{ARBI_WEB_BUILD_IDENTITY:webIdentity},
  poweredByHeader: false,
  serverExternalPackages: ["pg", "@arbi/protocol", "@arbi/gredice", "@arbi/simulation-core", "@arbi/audit"],
  webpack(config, { isServer }) {
    // Next's node_modules opt-out does not match pnpm workspace symlink targets.
    // Keep Node filesystem/schema consumers native, including in Server Components.
    // Native import also works with serverless loaders that reject require(ESM).
    if (isServer) config.externals.push(({ request }: { request?: string }, callback: (error: Error | null, result?: string) => void) => {
      if (request && ["@arbi/protocol", "@arbi/gredice", "@arbi/simulation-core", "@arbi/audit"].some(name => request === name || request.startsWith(`${name}/`))) callback(null, `import ${request}`);
      else callback(null);
    });
    return config;
  },
};
export default config;
