# Site installation geometry

See the [owning assembly or procurement policy](../../../docs/assemblies/site-installation/README.md).

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [motor-power-branch-cable](motor-power-branch-cable.scad) · [BOM](../../../bom/generated/parts/motor-power-branch-cable.md) | cable | Assumed Ø8 mm cable sample; jacket diameter, conductor sizes and installed routing unknown. |
| [outdoor-cat5e-signal-cable](outdoor-cat5e-signal-cable.scad) · [BOM](../../../bom/generated/parts/outdoor-cat5e-signal-cable.md) | cable | Assumed Ø6 mm cable sample; selected jacket diameter and installed routing unknown. |
| [underground-cable-sleeve](underground-cable-sleeve.scad) · [BOM](../../../bom/generated/parts/underground-cable-sleeve.md) | tube | Assumed 25 mm OD, 20 mm ID conduit sample; selected diameter, corrugations and routing unknown. |
| [wind-sensor-rs485-transceiver](wind-sensor-rs485-transceiver.scad) · [BOM](../../../bom/generated/parts/wind-sensor-rs485-transceiver.md) | board | Assumed 30 × 20 × 10 mm RS485 breakout; no selected module drawing exists. |
| [wind-speed-sensor](wind-speed-sensor.scad) · [BOM](../../../bom/generated/parts/wind-speed-sensor.md) | anemometer | Representative three-cup sensor with assumed 150 mm sweep and 120 mm stem; mounting and SKU unknown. |
