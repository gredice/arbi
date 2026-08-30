# Dock OpenSCAD sources

System context: [Dock assembly documentation](../../../docs/assemblies/dock/README.md).

## `dock-funnel`

[dock-funnel.scad](dock-funnel.scad) is a conical guide-ring concept with three mounting lugs. Its defaults use the repository baseline of a 275 mm mouth and 60 mm throat, within the documented 250–300 mm capture opening and 50–70 mm locating range. It demonstrates independent mouth, throat, wall, height, and mounting parameters. It does not define the complete approach envelope, pod stud, latch, sensor, shelter, drainage path, wear surface, impact energy, or release behavior.

Registry ID and design revision: `dock-funnel` `0.1.0`, status `concept-unvalidated`.

## `dock-nest`

[dock-nest.scad](dock-nest.scad) is a rounded mounting plate sized around the funnel's current capture envelope, with a shallow pod locating pocket, central latch/service opening, drain holes, and four mounting holes. It does not establish retention, structural support, weather sealing, electrical isolation, or a safe total-power-loss state.

Registry ID and design revision: `dock-nest` `0.1.0`, status `concept-unvalidated`.

Before prototype use, derive both models from the released pod envelope and docking-stud interfaces. Validate misalignment capture, contact forces, bounce, jam/release cases, drainage, ice/debris tolerance, latch confirmation, retention loads, and repeated approach cycles as one dock assembly.
