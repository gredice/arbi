# WT-806 adapter nominal geometry record

10 October 2026. Adapter revision **0.1.0**, **concept-unvalidated**.
Source and nominal geometry inspection by Codex; no physical reviewer or
fabricated prototype is recorded. The fixture remains unprinted and unloaded.

The [reproduction script](../../../scripts/corner-support/check-stand-adapter.py)
passed **265 checks** using OpenSCAD 2021.01, Python 3.9.6, trimesh 4.12.2,
numpy 2.0.2, scipy 1.13.1 and manifold3d 3.5.4 on the development Mac.
The [machine-readable record](stand-adapter-check.json) identifies the source
dependency hashes, mesh hashes, bounds, solid volumes and individual checks.
Generated meshes stay in temporary/ignored directories.

## Inspected configuration

- Four fabrication models at 26 / 30 / 35 mm nominal tube diameters: twelve
  watertight, consistently wound, connected positive-volume meshes with no
  degenerate triangles, matching the recorded print envelopes and Z=0 beds.
- Actual round-120 printed carrier halves, covered passive winch base, rear
  shield segments and a lower pole-port fascia used as collision references.
- Nominal unmodified tube surfaces, open split faces, M6 clamp shafts/washers,
  short M12 head bolts/washer/nut/tool bay, M8 winch bolts/washer/nut/socket
  paths, head rows 110 mm apart and winch rows 120 mm apart.
- Independently read canonical passive drum geometry and pole offset: the
  head line mesh and drum payout both lie at X=253.3 mm from the stand axis,
  within 0.001 mm comparison tolerance.
- Rejection of undersized/oversized tubes, insufficient clamp closing travel
  and a changed virtual-post offset outside this checked revision.

Interference tolerance is 0.002 mm³ for STL rounding; this is a nominal CAD
criterion, not a physical fit allowance. The existing fascia reference is
watertight and consistently wound but contains two zero-area tessellation faces;
its count is explicitly recorded. It is not one of the new adapter print
meshes. The boolean engine uses it only for clearance comparison. No claim
that all pre-existing reference geometry has non-degenerate triangles is made.

## Reproduction

From the repository root with the pinned OpenSCAD on PATH:

```bash
python -m pip install -r scripts/winch-booklet/requirements.txt
python scripts/corner-support/check-stand-adapter.py --record /tmp/stand-adapter-check.json
pnpm cad:check -- --require-openscad --jobs 4
pnpm docs:check
pnpm bom:check
git diff --check
```

The normal corner booklet build also runs this checker and writes its fresh
record into the ignored build output, so the owning corner CI job exercises
these interfaces. Compare numerical criteria and source identity across hosts;
STL hashes can differ with tessellation/serialization even at the pinned
OpenSCAD version.

The registry metadata addition required refreshing print-cost provenance.
`python3 packages/arbi-bom/scripts/capture-print-volumes.py /tmp/arbi-stand-release`
verified checksums, unchanged costed fabrication identities and all source
hashes against **cad-v0.1.12**, then captured its 65 existing costed mesh
volumes. `pnpm bom:generate` regenerated the reports. No material-cost recipe
or supplier price is assigned to the new adapter kit.

## Physical acceptance still open

The [assembly instructions](stand-adapter.md) and
[issue #147](https://github.com/gredice/arbi/issues/147) require received tube
diameters/straight lengths, clamp and factory-lock function, actual mass,
footprint and independent restraint, printed fit, tightening procedure,
slip/rotation observations, creep, material/process and tipping/load review.
The check models neither a complete measured WT-806 tripod nor compliance
under tightening. There is no allowable cable tension, torque, unattended
operation, powered-test acceptance or field-installation approval in this record.
