import { dashboardRuntime, SESSION_COOKIE, unavailable } from "./runtime";
import { bounded } from "@arbi/gredice";

export async function sessionRoute(request: Request): Promise<Response> {
  const runtime = dashboardRuntime();
  if (!runtime?.login || !runtime.revoke) return unavailable();
  const origin = request.headers.get("origin");
  if (!origin || !runtime.server.config.browserOrigins.includes(origin) || request.method !== "POST") return failure(403, "FORBIDDEN");
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return failure(413, "INVALID_REQUEST");
  try {
    // Streaming cap also applies when Content-Length is missing or forged.
    const reader = request.body?.getReader();
    if (!reader) return failure(403, "INVALID_REQUEST");
    let bytes = 0; const chunks: Uint8Array[] = [];
    await bounded(2000, async signal => {
      signal.addEventListener("abort", () => { void reader.cancel(); }, { once: true });
      while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 4096) { await reader.cancel(); break; } chunks.push(value); }
    });
    if (bytes > 4096) return failure(413, "INVALID_REQUEST");
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    if (form.get("action") === "logout") {
      const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
      if (token) { try { await runtime.revoke(token); } catch { return failure(503, "UNAVAILABLE"); } }
      return redirect(origin, "", 0);
    }
    const token = await runtime.login(form.get("code") ?? "");
    return token ? redirect(origin, token, 300) : new Response(null, { status: 303, headers: { location: `${origin}/?session=denied`, "cache-control": "private, no-store" } });
  } catch { return failure(503, "UNAVAILABLE"); }
}
function redirect(origin: string, token: string, maxAge: number) {
  return new Response(null, { status: 303, headers: { location: `${origin}${token ? "/sites/synthetic-site/user/overview" : "/"}`, "cache-control": "private, no-store",
    "set-cookie": `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${origin.startsWith("https:") ? "; Secure" : ""}` } });
}
function failure(status: number, error: string) { return Response.json({ error }, { status, headers: { "cache-control": "private, no-store" } }); }
