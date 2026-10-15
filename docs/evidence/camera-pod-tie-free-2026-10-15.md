# Camera pod tie-free retention — 15 October 2026

Status: nominal CAD checks passed; physical acceptance pending.
Design proposal: [#228](https://github.com/gredice/arbi/issues/228).
[Design, exact STL inventory, liner dimensions and assembly order](../assemblies/camera-pod/tie-free-retention.md).

The matched configuration is assembly r0.5.0, deck/carrier r0.3.0 and four new
retainer models r0.1.0. Historical sources and records retain their own hardware.

## Scope and evidence

[The machine-readable record](camera-pod-tie-free-2026-10-15.json) identifies the
tested source hashes, model revisions, mesh hashes and local report/artifact
hashes. The baseline commit is `05d4b730030f385037aa6e073e365bc20ef39f05`;
the modified source hashes identify this candidate independently of that commit.

The selected compact assembly installs zero ties, 18 printed pieces, 47 bought
screws in five variants, 61 flat washers, 47 nuts, one pivot shim, two OEM horn
screws and nine insulating liner pieces. The six new removable retainers use
12 additional M3 × 12 screws. New-joint nominal screw projection beyond the nut
is at least 1 mm; this does not qualify supplied hardware or printed retention.

| Check | Recorded result |
| --- | --- |
| Registry and OpenSCAD | 150 active models compiled with pinned OpenSCAD 2021.01 |
| Actual STL meshes | 40 nonempty checked meshes; current fabrication revisions and source hashes recorded |
| Rigid motion | 555 poses at 5° increments; zero neutral collisions or motion failures above 0.005 mm³ |
| Mechanical controls | Four overtravel stops detected; raised carrier-clamp and oversized-neck controls detected |
| Retainers | Six displaced-can capture controls; Ø8 mm nominal vent probe; 19 loading/removal paths; 12 straight driver probes; four correct/wrong liner-stack controls and oversized power-sleeve control |
| Service | 30 assembly paths, 24 tool probes and six local outlet envelopes passed; camera service at 50° tilt; neutral camera-driver obstruction detected as a negative control |
| Optics and power | 15 nominal 102° × 67° viewing-volume poses and 111 rigid power-route poses passed; misplaced-route control detected |
| Existing neck seam | 41 sections; 1.42268 mm minimum nominal clearance; taper checked in 1,571 sections |
| Solid-volume estimate | 268.68196 g at 1.27 g/cm³, before electronics, metal hardware and wires; not sliced or measured mass |
| Booklet | Revision 11, 18 A4 pages; 46 line-art figures; every page rendered and visually inspected; paired PDF/ZIP source/mesh checks passed |

## Reproduction and local validation

The build used Python 3.12.14 with the pinned booklet requirements, including
VTK 9.5.2. OpenSCAD ran in the pinned official ARM64 image
`openscad/openscad@sha256:a7f0ef7ef917ddb5817c1b50f65ca011f9d0b01c8aebe1d6f7895ab5eabcb602`,
with the repository mounted read-only, its output directory writable and
networking disabled. A full fresh export/check preceded a source/hash-guarded
reuse build for the final booklet and added capacitor driver probes.

```sh
python3 scripts/camera-pod-booklet/build.py --enclosure --output hardware/generated/camera-pod-tie-free-release
python3 scripts/check-booklet.py hardware/generated/camera-pod-tie-free-release --variant enclosure
pnpm cad:check -- --require-openscad --jobs 4
node --test scripts/check-cad.test.mjs
python3 -m unittest discover -s scripts/camera-pod-booklet -p 'test_*.py'
pnpm --filter @arbi/bom test
pnpm --filter @arbi/docs test
pnpm bom:check
pnpm docs:check
git diff --check
```

The CAD validator's 18 tests, booklet model-selection test, BOM's 50 Node and
five Python tests, and documentation site's 55 tests passed. BOM inputs and
generated reports are current, with 243 visible unresolved prioritized warnings.
These are local automated checks and visual artifact review, not bench tests.

## Physical limits

The capacitor remains an assumed Ø10 × 16 mm can; owner measurement is requested.
Nominal cable sections are Ø6 mm sleeved power, 16 × 0.3 mm FPC and 4 × 2 mm
servo loom. Soft-material compatibility, compression/grip, real connector
unloading, bend radii and fatigue require physical checks. Retainers do not
terminate positioning-line tension. Complete mass, strength/creep, heat, rain
and suspended/public operation remain unverified.
