# Compact camera pod stock-fastener checks — 15 October 2026

Status: **nominal CAD only; proposed local revision; physical acceptance pending**.
Design proposal: [#225](https://github.com/gredice/arbi/issues/225).
[Machine-readable record](camera-pod-stock-fasteners-2026-10-15.json) contains
source/report/artifact hashes, model revisions, installed counts, nut engagement
and the tested runtime. The [design and complete inventory](../assemblies/camera-pod/fastener-standardization.md)
explain the joint changes and replacement prints. The starting committed tree
is identified in the record; this local revision is not a merged acceptance.

## Configuration and results

- Assembly r0.4.0; twelve installed prints, twelve fabrication models including
  the optional uninstalled coupon, and 34 exported meshes including references
  and the non-manufacturing routing proxy.
- Five bought screw variants: eight M3 × 25, seven M3 × 12, twelve ordinary
  M2 × 8, four countersunk M2 × 8 and four countersunk M1.6 × 6. Two OEM horn
  centre screws remain supplied-servo hardware.
- Forty-five flat washers, one 0.7 mm pivot shim and 35 plain nuts. No camera
  washers: rear screw heads and captive front nuts bear on printed seats.
- All 144 registered models compile with pinned OpenSCAD 2021.01. The full
  registry check used the official Linux/ARM64 image digest in the JSON record.
- No neutral collisions or failures in 555 motion poses. Four overtravel stop
  controls, 1,571 taper sections and 41 neck-seam sections pass.
- Thirty staged service paths, 24 tool envelopes, fifteen Wide optical poses
  and the 111-pose fixed-power route pass. Proud-head, oversized-neck and
  misplaced-route controls detect their intended collisions.
- Twelve captive-seat loading paths and eight direct-M3-through-PCB controls
  pass. The latter demonstrate interference with the modelled Pi/camera holes;
  they are not received-board measurements. New/reworked screw joints project
  at least 0.8 mm beyond the nominal nuts; the camera joints project 0.88 mm.
- Converter bore, insertion/removal, driver and solder-pad checks pass. Wide
  camera installed/guided loading, focus allowance, latch/CSI access and
  previous-hood controls pass. The cradle remains one connected mesh in its
  original envelope and passes its retained load-path geometry probes.
- The alternative dry bench retains identical selections for eleven models,
  48 transitive CAD files and 137 assembly parts/transforms against the base
  commit. Its hardware and geometry are unchanged.
- BOM checks, 50 TypeScript BOM tests, five Python volume tests and 53
  documentation-site tests pass. The 240 existing prioritized BOM warnings
  remain visible; these checks do not resolve those engineering questions.
- Enclosure booklet revision 10 passes its 16-page A4, 34-mesh, 39-figure,
  source-hash and archive checks. All sixteen page renders were inspected;
  support and short-key notes were re-rendered and other pages compared
  pixel-for-pixel. The generated PDF and source/STL pack remain artifacts,
  outside canonical geometry and tracked publication snapshots.

## Integration with current main

The candidate was rebased onto `b7a631a` before PR submission, preserving the
merged camera-pod viewer fix and dock lower enclosure. Camera-pod CAD and
booklet generators are unchanged from the snapshot above. The combined registry
has 146 models; the regenerated BOM passes with 243 visible warnings. The
50 TypeScript and five Python BOM tests, 55 documentation-site tests, 388-file
Markdown check and whitespace check pass. The JSON integration section records
the changed registry/BOM hashes; full combined CAD/booklet checks run in PR CI.

## Compiler observation

The unchanged public servo visualization, including its illustrative 145 mm
leads, exceeds the validator's 120-second limit in the Intel macOS OpenSCAD
2021.01 app: its independent render takes 181.448 seconds. The same source
takes 52.802 seconds of render time in official ARM64 OpenSCAD 2021.01, and
54.09 seconds including container startup. Bounds and volume match, and both
meshes are watertight. The full registry passes in that pinned ARM64 runtime;
no unrelated servo geometry or timeout changes were made.

## Reproduce and inspect

Use Node.js 24+, pinned pnpm, OpenSCAD 2021.01 on PATH and the booklet Python
dependencies. On Apple Silicon the official ARM64 container avoids the Intel
binary's observed servo timeout; its immutable digest is in the JSON record.

```sh
pnpm cad:check -- --require-openscad --jobs 4
pnpm bom:check
pnpm --filter @arbi/bom test
pnpm --filter @arbi/docs test
pnpm docs:check
git diff --check
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-pod-stock-m3
python3 scripts/check-booklet.py hardware/generated/camera-pod-stock-m3 --variant enclosure
```

The full-solid PETG estimate is **251.662 g at 1.27 g/cm³** for twelve installed
prints. It excludes electronics, metal, wiring and supports and is not sliced
or measured mass. It does not demonstrate the 170 g complete-pod ceiling.

Actual stock counts/head styles, pocket and PCB fit, nut engagement, electrical
isolation, support removal, print strength/creep, frame/clamp loads, short-key
handle access, harness fatigue, servo settling, complete mass, dock/line
interfaces and rain/thermal behavior require physical inspection/testing.
These source checks do not authorize suspended or public operation.
