# Governance

ARBI is maintained in the `gredice` GitHub organization. Repository collaborators with merge authority act as maintainers under the organization's access controls and branch protection.

## Decision process

- Small, reversible changes are decided through normal pull request review.
- Changes to physical architecture, control ownership, safety behavior, electrical boundaries, public interfaces, repository-wide data contracts, licensing, or the V1 baseline require a design proposal and an architecture decision record.
- A decision record states context, decision, alternatives, consequences, compatibility impact, and evidence still required.
- Unresolved questions remain visible in issues or design-status documents. Silence is not approval and an unverified assumption does not become a baseline through implementation alone.

The current committed tree and tagged releases are the authoritative project baseline. This repository's GitHub issues and pull requests are the official work and review record, but they do not change the baseline until the resulting files or ADRs are merged. Decisions made elsewhere have no project standing until they are captured and reviewed here. See the [repository source-of-truth policy](docs/project/repository-source-of-truth.md).

Maintainers seek technical consensus. When consensus is not available, maintainers document the decision and rationale in the pull request or ADR before merging.

## Review ownership

Reviews follow the affected boundary:

- assembly owners review fit, interfaces, BOM usage, assembly, inspection, and maintenance;
- software owners review contracts, failure behavior, compatibility, tests, and deployment effects;
- safety-relevant changes receive explicit review of hazards, mitigations, validation limits, and residual risk;
- generated reports or geometry never substitute for review of canonical inputs.

Specific GitHub teams or CODEOWNERS entries are added only after the organization has defined and verified them.

## Contributions and licensing

Contributions are accepted through GitHub pull requests and are licensed under the repository's [AGPL-3.0-only license](LICENSE) unless a file explicitly states otherwise. Introducing a differently licensed dependency, asset, specification, or copied design requires origin, license, and compatibility review.

The project does not impose a contributor license agreement or Developer Certificate of Origin unless governance is explicitly amended before enforcement.

## Releases

- Development begins with `0.x` concept and prototype releases.
- A Git tag identifies source history; model, assembly, BOM, protocol, configuration, and software revisions identify compatible physical and executable artifacts.
- Release artifacts are generated from the tagged source and record tool versions and inputs.
- V1 requires the evidence listed in [goals and V1 scope](docs/project/goals-and-v1-scope.md), [design status](docs/project/design-status.md), [safety case](docs/system/safety-case.md), and [prototype and commissioning](docs/operations/prototype-and-commissioning.md).
- A release, green CI run, successful simulation, bench test, field test, and permission for public operation remain separate facts.

## Security and conduct

Security reports follow [SECURITY.md](SECURITY.md). Community behavior follows the [Code of Conduct](CODE_OF_CONDUCT.md). Maintainers may pause or revert work when disclosure, safety, licensing, or community risks cannot be reviewed adequately.
