# Pulley post head

The pulley post head is the top-mounted subassembly of the [corner support set](../corner-station/README.md). Four heads guide the positioning lines above the three ordinary winches and one powered winch. The head contains the pulley, post-mounted carriers, line keeper, covers, adapters and fastening hardware.

The current [printed-head design package](../corner-station/design-package.md) supplies the assembled and exploded CAD preview, hardware stack and assembly sequence. The [geometry record](../corner-station/geometry-check.md), [load-study note](../corner-station/printed-load-study.md) and [acceptance record](../corner-station/acceptance-record.md) describe the source checks and remaining physical work. Historical metal-head alternatives remain separate configurations.

The public manual gives this subassembly its own preview and registered-parts inventory. These are a subset of the existing corner-support models and BOM lines: direct BOM ownership remains `corner-support-set`, as recorded in [ADR-0010](../../decisions/0010-corner-support-and-winch-line-ownership.md). The display group adds no procurement quantity. The parent has a separate [mounted corner reference](../../../hardware/assemblies/corner-station/corner-station-assembly.scad) with an ordinary winch and this proposed head on an abbreviated post; its wavy drawing break and schematic mounting heights are illustration conventions.

The posts, soil interface and outward guying remain with the parent support set. The [winch subassembly](../winch/README.md) owns its positioning lines, drum, motor, enclosure and powered-line interface.

All head designs remain concept-unvalidated. Source geometry and nominal CAD checks do not establish print quality, fit, load capacity, creep, weather durability or installed acceptance.
