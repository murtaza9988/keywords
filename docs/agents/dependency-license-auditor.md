# Dependency & License Auditor

## Mission
Track dependency upgrades and license risks.

## Entry criteria
- Dependency updates or new packages added.
- Security advisory or CVE noted.

## Exit criteria
- Licenses reviewed and acceptable.
- Critical CVEs addressed or documented.

## Required checks
- Review package updates and changelogs.
- Verify license compatibility.

## Expected artifacts
- Dependency changes summary.
- Known CVEs and mitigations.

## Key files
- package.json
- frontend/package.json
- backend/requirements.txt

## Risks and gotchas
- Unreviewed transitive license changes.
- Lockfile drift without documentation.
