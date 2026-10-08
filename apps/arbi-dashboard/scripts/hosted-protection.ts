import type { Page } from "@playwright/test";

/** Keep the private protection credential on the one operator-selected origin. */
export async function protectHostedPage(page: Page, target: URL, oidc?: string) {
  // Chromium reports every redirect hop here. Playwright route header overrides
  // persist across redirects, while route.fetch does not preserve native navigation.
  const session = await page.context().newCDPSession(page);
  session.on("Fetch.requestPaused", async event => {
    const headers = Object.entries(event.request.headers)
      .filter(([name]) => name.toLowerCase() !== "x-vercel-trusted-oidc-idp-token")
      .map(([name, value]) => ({ name, value: String(value) }));
    if (oidc && new URL(event.request.url).origin === target.origin)
      headers.push({ name: "x-vercel-trusted-oidc-idp-token", value: oidc });
    try {
      await session.send("Fetch.continueRequest", { requestId: event.requestId, headers });
    } catch { await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "Aborted" }).catch(() => {}); }
  });
  await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
}
