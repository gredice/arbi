# Security policy

## Supported versions

Security fixes target the latest released ARBI version and the current `main` branch. Earlier prototypes may receive documentation or mitigation guidance when a backport is not practical. No current concept model or unreleased prototype should be treated as certified or safe equipment.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/gredice/arbi/security/advisories/new) for vulnerabilities involving source code, firmware, protocols, update mechanisms, credentials, exposed services, dependencies, or hardware behavior that could be exploited.

Do not open a public issue, discussion, or pull request containing exploit details, credentials, private keys, deployment addresses, or sensitive site information. Include the affected revision, realistic impact, reproduction details, and a proposed mitigation when safe to do so. Maintainers will coordinate disclosure through the private advisory.

If GitHub private vulnerability reporting is unavailable, open a minimal public issue asking a maintainer to enable a private reporting path. Do not include vulnerability details.

## Security-sensitive boundaries

Treat these areas as security-sensitive even before production implementation exists:

- motion, homing, docking, limits, safety states, and recovery commands;
- firmware and configuration authenticity, rollback, and compatibility;
- edge-to-controller, edge-to-pod, and cloud-to-edge authentication and replay handling;
- camera access, images, retention, privacy masks, and location metadata;
- credentials, update signing material, remote access, logs, and diagnostics;
- failure behavior that could lower lines, energize actuators, release the dock, or bypass isolation.

Never hardcode or log secrets. Browser-visible variables must contain only public values. Tests and examples use sanitized placeholders.

## Physical safety reports

A non-exploitable engineering hazard is normally tracked through a safety or design issue, without including private site details. Examples include structural capacity, line tension and clearance, pinch or entanglement points, weather exposure, mains protection, earthing, insulation, thermal limits, and total-power-loss behavior.

When a physical hazard can be triggered maliciously, bypasses an intended control, or exposes sensitive information, report it privately as a vulnerability.

Source validation, simulation, bench testing, and installed-system safety review provide different evidence. A security fix is not proof that the physical system is safe to operate.
