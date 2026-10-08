# Print material cost evidence — 8 October 2026

The Bambu Lab EU store was inspected live on 8 October 2026 with the **Filament with spool**, **1 kg** option and quantity **1**. PLA and PETG prominently advertise the lowest bulk-sale price even at quantity one; this record uses the displayed single-spool MSRP instead. It excludes bulk, refill, coupon, membership and promotional bundle discounts.

| Material | Single 1 kg spool | Density | Price source | Density source |
| --- | ---: | ---: | --- | --- |
| Bambu Lab PLA Basic | EUR 19.99 | 1.24 g/cm³ | [EU product page](https://eu.store.bambulab.com/products/pla-basic-filament) | [TDS V3.0, p. 2](https://store.bblcdn.com/s1/default/58b85d0f3db94878854a28fdb8a0006e/Bambu_PLA_Basic_Technical_Data_Sheet.pdf) |
| Bambu Lab PETG Basic | EUR 18.99 | 1.25 g/cm³ | [EU product page](https://eu.store.bambulab.com/products/petg-basic) | [TDS V3.0, p. 2](https://store.bblcdn.com/s1/default/cb94589bf7994fdcbfa833badefae9cd/Bambu_PETG_Basic_Technical_Data_Sheet.pdf) |
| Bambu Lab ASA | EUR 24.99 | 1.05 g/cm³ | [EU product page](https://eu.store.bambulab.com/products/asa-filament) | [TDS V3.0, p. 2](https://store.bblcdn.com/ad7b08230c164e72856cffbe06bb7dc9.pdf) |

Destination: Zagreb, Croatia. These are EU displayed reference prices; the store states that price and VAT can change with destination at checkout. Croatian final VAT and shipping were not observed, so tax treatment remains unknown and no free-delivery assumption is made. No purchase is recorded. Prices are a dated observation, not a permanently current supplier fact.

The [canonical print catalog](../catalog/fabrication.json) stores spool mass, currency, observation timestamp, price basis, URLs, density and build-specific recipes. Material cost represents consumed plastic; whole-spool purchase rounding and surplus inventory are separate procurement concerns.

## Weight and kit basis

Mesh volumes come from [CAD release cad-v0.1.4](https://github.com/gredice/arbi/releases/tag/cad-v0.1.4), source commit `4e0eb44fd8df41174272569e910db93b835e51b2`. The release's CAD source hashes match this checkout. The [capture script](../../packages/arbi-bom/scripts/capture-print-volumes.py) verifies release checksums, closed manifold edges, consistent orientation and positive signed volume. Volume in mm³ is divided by 1000 to obtain cm³, rounded to six decimal places; mass is volume × the selected material's density. Mass is rounded to three decimal places for display, after quantity extension, and cost is rounded to cents after extension. The calculator uses exact decimals for weight conversion and money.

- Camera chassis and gimbal use the current [rain-enclosure print list](../../hardware/assemblies/camera-pod/payload-enclosure.md): 16 installed pieces, excluding old gimbals, dry-bench alternatives and the optional fit coupon. The owners split the current kit without overlap. Bambu PETG Basic's density is 1.25 g/cm³; earlier generic PETG mass evidence at 1.27 g/cm³ remains historical.
- The [drum print list](../../hardware/assemblies/winch/README.md#print-list) supplies three passive kits plus one powered kit, including eight flanges, eight clamp halves and thirteen pins. Four BOM drums represent that batch; fractional per-unit averages do not mean interchangeable variants.
- Each [mount kit](../../hardware/assemblies/winch/mount.md) includes two lower bearing supports, two caps, one motor stand and one coupling guard. Metal bases and installed hardware remain separate.
- The [full-cover print list](../../hardware/assemblies/winch/full-cover.md) supplies 126 installed prints across four winches, excluding four optional bench blanks. ASA is the costing selection for this exposed shell kit. Earlier/plain alternative parts are not added to the pole-routing version.
- The dock funnel and nest use their own current registered meshes, and the pulley keeper is extended across four corners.
- Optional desk feet, optional round-pole cosmetic covers and the deferred pole-pulley clamp pair have recipes and item-page comparisons but contribute nothing to the base build. Machined pole saddles are excluded from print costing. Planned dock latch, weather hood and brake have no invented geometry or zero cost.

These are **solid-volume material estimates**, not slicer output or measured weights. They include the solid CAD walls but assume fully dense material wherever CAD contains a solid. They exclude slicer supports, brims, purge and failed prints. They can substantially exceed sparse-infill consumption; thin walls can also require different slicer handling. No physical mass, strength, fit, ingress protection or safe operation is established.

PETG is the prototype costing selection for structural/functional recipes; ASA is selected for exposed covers. PLA is a price comparison. The costing choices do not alter engineering qualification or establish material suitability. Energy, depreciation/machine time and labour remain unknown rather than zero.
