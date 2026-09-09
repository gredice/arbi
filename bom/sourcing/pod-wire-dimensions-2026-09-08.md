# Pod wire dimensions — 2026-09-08

Evidence: the owner supplied this [wire specification table](evidence/awg-wire-table-2026-09-08.png)
in the discussion of the selected AliExpress AWG26 silicone wire. This is a
supplier-table claim supplied by the owner, not a measurement or independent
verification of the delivered wire or its listing variant. Certification logos in
the image are not recorded as verified certifications.

The AWG26 row states:

- insulated outside diameter: 1.5 mm;
- conductor construction: 30 strands, each 0.08 mm diameter;
- conductor area: 0.15 mm².

The strand-area calculation, `30 × pi × (0.08 / 2)^2`, gives approximately
0.1508 mm², consistent with the table. The AWG label remains the supplier's label.
The earlier buyer-comment dimensions of 1 mm insulated and 0.3 mm bare are
superseded as the provisional geometry basis by this variant-specific table.

## Modeling basis

Apply a 1.5 mm nominal insulated wire diameter to both selected wire colors,
`pod-power-wire-black-awg26` and `pod-power-wire-red-awg26`. Keep it parameterized.
The existing supplier selections are unchanged.

For two wires arranged on opposite sides of a 1.5 mm Dyneema core, the nominal
cross-sectional envelope is `1.5 + 2 × 1.5 = 4.5 mm`. This is a geometric estimate,
not the measured wound assembly diameter. Groove clearance is additional. Do not
use the passive 1.5 mm-line groove for this variant.

Insulation tolerance, conductor resistance, bend life and assembled envelope are
inspection/test items. They do not block a parameterized first prototype design.
The larger groove pitch changes drum width; reconcile capacity, print segmentation
and shaft stock allocation before issuing a powered-drum cut list.
