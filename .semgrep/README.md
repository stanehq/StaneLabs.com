# Local SAST rules

These project-authored MIT rules run with the Semgrep Community Edition engine.
No account, remote rule pack, source upload, or paid GitHub Code Security license
is required. The CI image is pinned by digest in the tool lock.

The checks cover dynamic JavaScript evaluation, nonconstant Node shell commands,
TLS verification bypasses, sensitive payload logging, and browser/request input
flowing directly into HTML sinks. They complement lint, dependency auditing,
secret scanning and container scanning; this small rule pack is not a complete
audit or a proof of security. CE taint tracking here is intraprocedural.

`bash scripts/ci/check-sast.sh` first tests each detector against positive and
negative fixtures, then scans application code. Findings and scan warnings fail
the command. JSON and SARIF are saved locally under `reports/`; CI keeps them as
ordinary private artifacts unless GitHub Code Security is enabled separately.

The fixtures are intentionally vulnerable examples, excluded from the actual
application scan and ESLint. Production HTML generated from the trusted Feather
icon library and escaped JSON-LD is not banned by a blanket HTML rule.

There are no blanket finding suppressions. New exceptions must identify the
specific finding, explain the safe data flow, and retain a regression fixture.
