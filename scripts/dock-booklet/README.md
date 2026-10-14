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
The source pack also preserves the selected dock appearance board, its generation
record and local product-family references. Those images are styling evidence only.

Checks cover connected watertight parts, rigid print poses and nominal bed bounds,
part/post/current-pod interference, sampled crown/skirt skin, local socket access,
sampled fork travel and supported release of the complete represented pod and its
bridge/shoes/stud hardware. The rounded crown prints rim-down with reviewed internal
supports; the print bounds do not establish a support-free process.
The revised stud prints head-down with reviewed flange supports. Written mesh
sections verify its flat retaining shoulder, the 0.2 mm unloaded fork gap and
blocked descent after contact; they do not qualify bearing load or release force.

Each roof quarter is checked against the other quarters, retained hardware, core,
pod and all four 1.5 mm vertical line probes from Z=-200 to 800 mm: remove roof-stack
and seam hardware, lift 60 mm, then move inward 100 mm along the quadrant diagonal.
The long probes prevent false clearance after lifting beyond a short line model.
This is a sampled rigid service path with independently supported dummy/carrier;
sloping site lines and full tool/hand access remain unverified.

Independent controls reproduce blocked descent with a closed fork, a line collision
in an uncut guide and blocked roof removal when its outward slot is replaced by a
closed hole. The checker repeats removal and full-pod release from the written ZIP
meshes, and re-derives skin sections. These establish neither
continuous flight clearance nor material, load, weather, actuator or physical
acceptance. See [dock acceptance](../../docs/assemblies/dock/acceptance-record.md).

CI builds and checks this package; the versioned CAD release publishes the PDF and
ZIP. Sources are committed; generated meshes, figures and PDF are artifacts.
