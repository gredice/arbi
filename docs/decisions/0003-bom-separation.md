# ADR-0003: Separate parts, assembly quantities, and supplier offers

- Status: Accepted
- Date: 2026-08-30

## Context

A flat BOM row that combines a part, assembly/category tags, quantity, supplier, price, product URL, MOQ, and Croatia shipping cannot reliably express multiple interchangeable offers, location-dependent availability, supplier-cart shipping, pack rounding, build variants, historical price checks, or the same part used by several assemblies.

The same calculations must work in files and later in an interactive website.

## Decision

Use normalized, version-controlled data with four separate concerns:

1. **Part catalog** — stable engineering identity, specification, base unit, lifecycle, disciplines/traits, fabrication linkage, and repository revision history. Multiple offers can contain the same part without duplicating that identity.
2. **Assembly/build manifests** — the physical or explicitly non-physical owner of each usage, its quantity, inclusion state, and repository revision history. Waste, spares, mass, criticality, and compatibility metadata can be added when supported by evidence.
3. **Supplier offers** — supplier and checkout-group identity, SKU/URL, qualification, pack contents, MOQ, and purchase increment. A supplier may have multiple seller, basket, or warehouse checkout groups.
4. **Destination quote snapshots** — dated price, currency, tax, availability, observation, exchange-rate, and checkout-group shipping evidence for one destination. Shipping is not copied onto each part line.

The implemented file calculator uses explicit pinned offer selections. It must:

- validate schemas and references;
- use integer minor units or exact decimal arithmetic for money;
- round pack quantities and respect MOQ;
- count supplier-cart shipping once according to the selected quote/rule;
- keep tax treatment, exchange rates, destination, and observation timestamps explicit, and block a complete total when required landed-cost evidence is missing;
- report selected, unavailable, unverified, and unresolved evidence without treating null as zero;
- keep physical-assembly, shared-bundle, shared-procurement-stock, and checkout-group values distinct;
- emit machine-readable output plus human-readable reports;
- expose the same pure calculation interface to CLI, CI, and the future website.

Cheapest-compliant selection, explicit quote-age policies, duties/tax calculation, lead-time planning, compatibility substitution, and interactive destination comparison are planned extensions. They are not claims about the current CLI.

Commercial data is historical evidence, not a promise of current price or stock. Calculations never silently fetch live pricing during a reproducible build.

## Consequences

- One engineering part can have multiple suppliers and prices without duplicate part identities.
- Shipping calculations can reflect carts and destinations more accurately.
- Assembly ownership and build quantities remain stable when suppliers change.
- The model is more explicit and requires validation tooling and deliberate data maintenance.
- Generated reports are derived; source data and calculator revision remain authoritative.

## Alternatives considered

### Preserve one flat CSV/table

Rejected because repeated supplier rows obscure part identity and shipping/build semantics.

### Store only a selected shopping list

Rejected because it loses alternatives, history, compatibility, and destination-specific decisions.

### Fetch all commercial data live

Rejected for reproducibility, availability, security, terms-of-service, and review reasons. Explicit refresh tooling may be added later.

## References

- [Physical assembly taxonomy](0001-physical-assembly-taxonomy.md)
- [Design status](../project/design-status.md)
- [Repository source-of-truth policy](../project/repository-source-of-truth.md)
