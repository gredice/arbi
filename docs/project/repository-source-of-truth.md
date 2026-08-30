# Repository source-of-truth policy

## Authority

This GitHub repository is the sole system of record for ARBI. The accepted engineering state is defined by committed repository content and, for releases, the applicable tagged tree. The repository contains:

- committed documentation, CAD, BOM data, software, configuration, schemas, and test fixtures;
- Git history and tagged releases;
- GitHub issues as the official record of proposed work, questions, hazards, and unresolved decisions;
- GitHub pull requests as the official review record and rationale for accepted changes;
- committed architecture decision records for durable design choices; and
- committed calculations, inspections, measurements, and test records for validation claims.

Issues and unmerged pull requests do not define accepted engineering state. An external page, document, spreadsheet, file share, chat, email, dashboard, or local uncommitted file is not an ARBI project record. Information from one of those locations has no authority until it is captured in the appropriate repository file or GitHub record and reviewed through the normal contribution process.

## Precedence

For a tagged release, the tagged tree and the release artifacts derived from it define that release. For active development, the default branch defines the current baseline. A pull request describes a proposed change until it is merged; an issue records work or discussion but does not by itself change the baseline.

When records disagree:

1. the applicable tagged tree controls a released version;
2. the current committed canonical input controls a generated view or artifact;
3. an accepted ADR controls a durable architecture decision until a later accepted ADR supersedes it; and
4. the conflict must be resolved in a pull request rather than by relying on an off-repository explanation.

## Record ownership

| Information | Authoritative record |
| --- | --- |
| Engineering requirements and assembly definitions | Committed files under `docs/` |
| Parametric geometry | Registered OpenSCAD sources under `hardware/` |
| Parts, usages, offers, quotes, destinations, and build scenarios | Canonical inputs under `bom/` |
| Executable behavior and shared contracts | Committed code, configuration, schemas, and fixtures |
| Open work, hazards, and unresolved questions | GitHub issues linked from affected files when durable context is needed |
| Review discussion and accepted change rationale | GitHub pull requests and resulting commits |
| Consequential architecture choices | ADRs under `docs/decisions/` |
| Validation claims | Committed test, calculation, inspection, or measurement records tied to an exact revision and configuration |
| Released state | Git tags and release artifacts generated from the tagged tree |

Generated reports, rendered geometry, website pages, CI summaries, and simulator outputs are derived views. They never override their canonical inputs, and their presence is not physical validation.

## External evidence

External manufacturer documents, standards, research, supplier pages, and qualified professional assessments may support an engineering claim. Cite a stable document and revision close to the claim, record the access or observation date when the material can change, and respect its license. Capture project-owned requirements, selections, calculations, and conclusions in the repository so contributors do not need access to a private or mutable external system.

Commercial URLs and dated quotes are evidence for a particular observation, not permanent product facts. Credentials, private vulnerability reports, sensitive site information, and licensed material that cannot be redistributed must remain outside the public tree; the repository should retain only a safe reference and the reviewable conclusion.

## Changing the baseline

Make baseline changes through pull requests. Link the affected issue, ADR, model revision, BOM scenario, software contract, or validation record as appropriate. A claim becomes **Validated** only when the supporting record identifies the tested revision, configuration, conditions, equipment, result, and reviewer.

No synchronization with another knowledge system is required or permitted as part of the project workflow. The future website must render or calculate from repository-owned inputs and must not create a parallel editing authority.
