# Control cabinet geometry

See the [owning assembly or procurement policy](../../../docs/assemblies/control-cabinet/README.md).

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [control-panel-enclosure](control-panel-enclosure.scad) · [BOM](../../../bom/generated/parts/control-panel-enclosure.md) | enclosure | 400 × 300 × 200 mm starting cabinet envelope from catalog; walls, door and mounting details assumed. |
| [controller-buck-converter-48v-5v](controller-buck-converter-48v-5v.scad) · [BOM](../../../bom/generated/parts/controller-buck-converter-48v-5v.md) | board | Assumed 45 × 25 × 15 mm occupied envelope; no converter package drawing is recorded. |
| [din-rail-ground-distribution-block](din-rail-ground-distribution-block.scad) · [BOM](../../../bom/generated/parts/din-rail-ground-distribution-block.md) | terminal | Assumed 80 × 35 × 45 mm block with representative terminals; terminal count and DIN clip unknown. |
| [emergency-stop-switch](emergency-stop-switch.scad) · [BOM](../../../bom/generated/parts/emergency-stop-switch.md) | switch | Catalog 22 mm panel stem with an assumed Ø40 mm mushroom; contacts and panel fit unspecified. |
| [pico-terminal-expansion-board](pico-terminal-expansion-board.scad) · [BOM](../../../bom/generated/parts/pico-terminal-expansion-board.md) | terminal board | Assumed 90 × 60 × 18 mm terminal-board envelope; EP-0145 mounting and terminal geometry unverified. |
| [power-supply-48v-350w](power-supply-48v-350w.scad) · [BOM](../../../bom/generated/parts/power-supply-48v-350w.md) | psu | Assumed 215 × 115 × 50 mm PSU envelope with vent/terminal details; exact kit supply drawing unverified. |
| [raspberry-pi-pico-2-w](raspberry-pi-pico-2-w.scad) · [BOM](../../../bom/generated/parts/raspberry-pi-pico-2-w.md) | pico | Assumed nominal 51 × 21 mm PCB with illustrative headers/USB; confirm header height and component keep-outs. |
