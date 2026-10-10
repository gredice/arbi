/** Preview is an observation-only, unconfigured application boundary. */
export function isBranchPreview(env = process.env) { return env.VERCEL_ENV === "preview" && env.VERCEL_TARGET_ENV !== "isolated-test"; }
