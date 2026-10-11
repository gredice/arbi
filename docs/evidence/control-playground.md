# Control playground evidence

Scope: [#49](https://github.com/gredice/arbi/issues/49), [ADR-0012](../decisions/0012-bounded-control-playground.md). Evidence is source/native-host/synthetic-browser only.

The browser harness runs Chromium against a built Next application, a fresh PostgreSQL database and an independent native SQLite edge job consumer. Commands and snapshots/outcomes traverse actual HTTP, current session/directory checks, the device proof boundary, durable cloud jobs, local journal and simulated module proofs. The browser does not call the plant or fabricate a completion.

Checks cover fixed engineer/operator permissions, mode spoofing, forbidden renewal/device escalation, two independent sessions with one winning lease, lost submission acknowledgement after real server admission, identical duplicate job IDs, authentic accepted/running/completed reports, one durable command, explicit observed-state read after reload, stale observation disabling manual entry, keyboard gesture/page hiding and no subsequent submission replay, gimbal blocking without Ready evidence, and a 390 px viewport. Existing native jobs tests also verify minimized control readback with the original snapshot age and signed terminal result across independent database connections.

The fixture local journal enforces its own 400 ms bounded manual job request and 750 ms deadman; those values are chosen host parameters. Admission originally exercised a too-short 200 ms local deadline and reported `DEADLINE_EXPIRED`; the UI retained failure rather than inventing completion. This is development evidence, not a physical deadline qualification. Synthetic return-home uses the committed initial position and does not establish a physical reference.

No hardware, real surveyed garden, live camera bytes, provider acceptance or installed-system safety is claimed. Virtual capture witnesses remain distinct from future image delivery/storage. The source and native job suites retain their existing capture/gimbal/interlock/phase proofs; physical motion/gimbal and watchdog gates remain open.

Development-host verification: dashboard source suite 75 passed (14 native-only skips), native PostgreSQL suite 50 passed, browser suite 13 passed, edge jobs/manual/crash-recovery suite 120 passed. Dashboard and edge lint/type checks, dashboard production build, ordinary/preview HTTP denial and Markdown link/whitespace checks passed. Browser control reads also reject a response above their 64 KiB limit and clear the observation. Host timings are development measurements, not physical bounds.
