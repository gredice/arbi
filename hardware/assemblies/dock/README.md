# Dock OpenSCAD sources

System context: [Dock assembly documentation](../../../docs/assemblies/dock/README.md).

## `dock-funnel`

[dock-funnel.scad](dock-funnel.scad) is a conical guide-ring concept with three mounting lugs. Its defaults use the repository baseline of a 275 mm mouth and 60 mm throat, within the documented 250–300 mm capture opening and 50–70 mm locating range. It demonstrates independent mouth, throat, wall, height, and mounting parameters. It does not define the complete approach envelope, pod stud, latch, sensor, shelter, drainage path, wear surface, impact energy, or release behavior.

Registry ID and design revision: `dock-funnel` `0.1.0`, status `concept-unvalidated`.

## `dock-nest`

[dock-nest.scad](dock-nest.scad) is a rounded mounting plate sized around the funnel's current capture envelope, with a shallow pod locating pocket, central latch/service opening, drain holes, and four mounting holes. It does not establish retention, structural support, weather sealing, electrical isolation, or a safe total-power-loss state.

Registry ID and design revision: `dock-nest` `0.1.0`, status `concept-unvalidated`.

Before prototype use, derive both models from the released pod envelope and docking-stud interfaces. Validate misalignment capture, contact forces, bounce, jam/release cases, drainage, ice/debris tolerance, latch confirmation, retention loads, and repeated approach cycles as one dock assembly.

## Appearance

The structural capture/retention parts preview in charcoal following the [industrial design conventions](../../../docs/project/industrial-design.md). Their dimensions and physical design revisions are unchanged. Future protective housings use the rounded white-shell convention while keeping these interfaces visible and accessible.

## Approximate BOM visualizations

These `visualization` models show catalog items in the Parts inventory. They are **Unverified** and are not manufacturing sources. Shape is not yet fully defined and needs rework against the selected supplier drawing or measured item before fit or clearance decisions. Nominal dimensions recorded in the catalog remain requirements, not measurement evidence. Threads, connectors, internal construction and fine detail are simplified. Kits and assortments show representative samples, not quantities; cable loops and lengths show samples, not installed routing.

| BOM item / source | Shape | Dimension basis and remaining uncertainty |
| --- | --- | --- |
| [dock-latch-hardware](dock-latch-hardware.scad) · [BOM](../../../bom/generated/parts/dock-latch-hardware.md) | latch | Representative stud, latch arm and pivot; retention interfaces and final mechanism are not yet defined. |
| [dock-weather-hood](dock-weather-hood.scad) · [BOM](../../../bom/generated/parts/dock-weather-hood.md) | hood | Catalog 300 × 300 mm starting roof footprint with an assumed 60 mm slope and 3 mm wall. |
