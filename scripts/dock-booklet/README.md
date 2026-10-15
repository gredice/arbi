# Dock booklet builder

Build the DOCK-IF-01 supported-dummy bench kit from canonical OpenSCAD sources.
Use OpenSCAD 2021.01, Python 3.12 and `../winch-booklet/requirements.txt`.

```bash
python scripts/dock-booklet/build.py --output hardware/generated/dock-booklet
python scripts/check-booklet.py hardware/generated/dock-booklet --variant dock
```

The ignored output contains a ten-page actual-mesh assembly PDF and paired ZIP
with print-oriented STLs, installed-coordinate meshes, contextual pod/post/line
meshes, canonical sources, figures and hash manifests. `kit.json` supplies per-kit
print quantities and `hardware.json` the nominal bought inventory; the committed
BOM remains authoritative. The builder checks the two inventories against the BOM.
The source pack also preserves the selected dock appearance board, its generation
record and local product-family references. Those images are styling evidence only.

Checks cover connected watertight parts, rigid print poses and nominal bed bounds,
part/post/current-pod interference, sampled crown/skirt skin, local socket access,
sampled fork travel and supported release of the complete represented pod and its
bridge/shoes/stud hardware. The rounded crown prints mounting-seat down from
its dedicated panel-boss contacts, with reviewed perimeter/internal supports;
the print bounds do not establish a support-free process. The four removable
lower panels use top-tray-down print poses, with three ordinary pieces and one
rear arm/fork panel. They have dedicated M3 × 25 bolts, washers and DIN 985 nuts;
their service does not remove the structural M4 fasteners.
The revised stud prints head-down with reviewed flange supports. Written mesh
sections verify its flat retaining shoulder, the 0.2 mm unloaded fork gap and
blocked descent after contact; they do not qualify bearing load or release force.

Each roof quarter is checked against the other quarters, retained hardware, core,
pod and all four 1.5 mm vertical line probes from Z=-200 to 800 mm: remove all
four lower panels first, retaining upper washers/nuts in their roof pockets
during withdrawal; then slide the upper items inward out of the accessible
pockets and remove roof-stack and seam hardware, lift 60 mm, then move inward
100 mm along the quadrant diagonal.
The long probes prevent false clearance after lifting beyond a short line model.
This is a sampled rigid service path with independently supported dummy/carrier;
sloping site lines and full tool/hand access remain unverified.

Ordinary lower panels use a sampled nominal path 110 mm horizontally outward along
their cardinal axis, then 100 mm down, with the current guide retained. Rear
panel removal is staged: 60 mm outward, 20 mm down, another 50 mm outward and
another 80 mm down. Final cumulative displacement is 110 mm outward and
100 mm down. The intermediate drop avoids retained M8 lap hardware. Dedicated
bolts/lower washers are removed only for the panel being moved; every other
panel's fasteners and all roof-pocket upper washers/nuts remain fixed during
its motion. Upper items are extracted only after all panels are clear.
The reverse pocket path checks nominal upper-hardware insertion.
Hardware stacks, local Ø5 × 80 mm driver envelopes, cable-seam/arm-window
clearance and sampled panel removal are checked in the generated geometry
report. Three normal-wall sections are 2.7902–2.8098 mm and the tray is 3 mm;
these apply only to the sampled sections. The owning
[lower-enclosure record](../../docs/assemblies/dock/lower-enclosure.md) separates
this nominal evidence from slices, received fit, creep/strength, wind/runoff
and actual sloping-line/hand access.

Independent controls reproduce blocked descent with a closed fork, a line collision
in an uncut guide and blocked roof removal when its outward slot is replaced by a
closed hole. The checker repeats removal and full-pod release from the written ZIP
meshes, and re-derives skin sections. Lower-enclosure controls also detect
closed cable seams/rear arm windows, lowering before outward withdrawal,
incomplete washer pockets and straight rear withdrawal into M8 lap hardware.
These establish neither
continuous flight clearance nor material, load, weather, actuator or physical
acceptance. See [dock acceptance](../../docs/assemblies/dock/acceptance-record.md).

CI builds and checks this package; the versioned CAD release publishes the PDF and
ZIP. Sources are committed; generated meshes, figures and PDF are artifacts.
