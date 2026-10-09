# Dock booklet builder

Build the DOCK-IF-01 supported-dummy bench kit from canonical OpenSCAD sources.
Use OpenSCAD 2021.01, Python 3.12 and `../winch-booklet/requirements.txt`.

```bash
python scripts/dock-booklet/build.py --output hardware/generated/dock-booklet
python scripts/check-booklet.py hardware/generated/dock-booklet --variant dock
```

The ignored output contains a nine-page actual-mesh assembly PDF and paired ZIP
with print-oriented STLs, installed-coordinate meshes, contextual pod/post/line
meshes, canonical sources, figures and hash manifests. `kit.json` supplies per-kit
print quantities and `hardware.json` the nominal bought inventory; the committed
BOM remains authoritative. The builder checks the two inventories against the BOM.

Checks cover connected watertight parts, rigid print poses and nominal bed bounds,
part/post/current-pod interference, a synthetic vertical line pose, sampled fork
travel and supported stud release. Independent controls reproduce blocked descent
with a closed fork and a line collision in an uncut guide. These establish neither
continuous flight clearance nor material, load, weather, actuator or physical
acceptance. See [dock acceptance](../../docs/assemblies/dock/acceptance-record.md).

CI builds and checks this package; the versioned CAD release publishes the PDF and
ZIP. Sources are committed; generated meshes, figures and PDF are artifacts.
