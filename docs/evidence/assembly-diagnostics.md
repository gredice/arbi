# Assembly diagnostics host and browser evidence

- Date: 2026-10-11
- Work record: [#48](https://github.com/gredice/arbi/issues/48)
- Revision: source/tests in this PR; its merge commit identifies the accepted revision
- Host: isolated Linux x86-64, Node 24.19.0, pinned pnpm 11.5.2
- Data: committed bounded plant/configuration fixtures and temporary native PostgreSQL
- Browser: Playwright 1.58.2, Chromium 145; private ephemeral test session; no live credentials

The [projection tests](../../apps/arbi-dashboard/src/dashboard/assemblies.test.ts) verify
all baseline assemblies, passive/unavailable sensing, declared measurement capability,
stale original quality, old/repeated samples, missing sequence intervals, source/revision
reset, 60-point retention and nested export redaction. Protected API tests exercise
current authorization, cross-site/role denial, invalid units/mixed versions, response
bounds, selected fault/command adapter bounds and post-read revocation.

The built application browser suite verifies all operational screens and current
session/directory behavior. Its selected diagnostics story opens all 19 inventory rows,
starts only the chosen pod detail, checks source quality, then hides/closes demand and
downloads the redacted bounded export. Native redirect/protection-header checks remain
separate from this isolated application identity. Mobile width is checked at 390 pixels;
the screenshot is a local test artifact, not committed binary output.

The first full browser run passed 9/9 checks. The final source adds explicit optional
fault-history projection and counts bytes only after a response completes; cancelled
responses cannot produce a false completed-payload receipt.

Final source validation: dashboard lint/typecheck/build passed; ordinary dashboard
tests passed 65 assertions with 10 explicit native-only skips; the independent native
PostgreSQL suite passed 28/28 with no skips. The selected-diagnostics/all-screen browser
regression passed 2/2 checks; after the mobile table and measurement-fixture correction,
the final focused check passed 1/1, including 390-pixel width, hidden/closed demand and
nested redaction. It measured 8,709 JSON response bytes over three completed selected
requests, with zero periodic detail requests for overview, hidden or closed views.
Built ordinary/branch-preview HTTP checks and documentation/whitespace checks passed.
The mobile provenance table uses the existing horizontal scroll container rather than
compressing source identities into unreadable columns.

This measures JSON application payload and browser lifecycle, not HTTP/TLS/carrier
bytes, real garden uplink demand, physical sensing or installed-system behavior. The
snapshot/chart source is an explicitly bounded synthetic plant. Configured firmware
references and chart motion cannot establish installed firmware or calibrated safety.
