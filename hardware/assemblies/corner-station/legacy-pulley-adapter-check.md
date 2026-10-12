# Legacy carrier adapter: nominal geometry record

12 October 2026. Adapter r0.1.0, **concept-unvalidated**. Automated source/mesh
inspection with OpenSCAD 2021.01, Python 3.12 and trimesh 5.1.1; reviewed in
this change. This records nominal geometry, not received print acceptance.

The [instructions](legacy-pulley-adapter.md) define the tested interface,
configuration, bought hardware and reversible trial sequence. Reproduce with:

```bash
python3 scripts/corner-support/check-legacy-adapter.py
```

The checksum-pinned text fixture is the complete old carrier source from
`84f3b52829cafc73c5765cd619a582c97f770439`, with SHA-256
`414defcdde68792a9b994532f13a3684e8a735dc89273652185e520b0ae2923b`.
Only its library include is redirected when meshing. This makes the frozen
interface comparison independent of Git history availability in CI/packs.

| Check | Observed nominal result |
| --- | --- |
| Frozen carrier vs original source | Zero nearest-vertex deviation in all five variants; boolean volume roundoff 0.006–0.236 mm³, within the recorded numerical tolerance |
| Variants | Round 100/120/140 with 1.5 mm line; round 120 with 4.5 mm line; square 100 with 1.5 mm line |
| Each adapter half | One connected, watertight solid; consistent winding; positive volume; approximately 8.327 cm³ |
| Public print entrypoints | Flat bed at nominal Z0; 40.6 × 57 × 7.4 mm bounds; same volume/pose as installed halves after rigid transform |
| Socket vs each old carrier | 0 mm³ overlap |
| M8 fastener stack vs carrier/adapter | 0 mm³ overlap |
| Native 4.7 mm pin vs adapter | 0 mm³ overlap; M8 in native bore rejected |
| Block vs adapter, carrier and extra fastener | 0 mm³ overlap at 0/15/30/45/60/75/90° in the nominal pin plane |
| Simple bush at the original pin point | Rejected: approximately 314.900 mm³ reconstructed block/old-lug overlap at 45° |
| Round-120 passive sheave centre | X237.55/Z100.3015; nominal vertical winch tangent retained; horizontal span 35 mm lower than r1.0.0 |

The generated JSON records hashes for the exact source dependencies and
checker, plus per-variant results. The standard BOM volume capture also
refreshed the 79 existing costed fabrication meshes; the temporary kit is
optional and has no invented material or commercial estimate.

The broad local command `pnpm cad:check -- --require-openscad` passed static
validation for 165 registered models but exceeded its 120-second per-export
limit on the unchanged `winch-drum-passive-1`. The two new print entrypoints
were independently compiled and inspected by the adapter checker; full
repository CAD compilation remains a separate CI check.

Block neck/detail surfaces, threads, actual print clearances, pin/ring locking,
groove seating and line fleet angle remain unmeasured. These results establish
neither strength/creep nor loaded or outdoor operation. Physical tests must
record the actual parts, print process, equipment, conditions and reviewer;
retain the [head acceptance gates](../../../docs/assemblies/corner-station/acceptance-record.md).
