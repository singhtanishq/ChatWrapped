# Security Policy

## Reporting

Please report security issues privately via [GitHub Security Advisories](https://github.com/singhtanishq/ChatWrapped/security/advisories/new)
rather than public issues. Include reproduction steps and, if relevant, a synthetic fixture (never a real chat export).

## Scope notes

ChatWrapped is a fully static, client-side application:

- No server-side code, database, or user accounts exist, so account/data breaches do not apply.
- Conversation files are processed in the visitor's browser and never transmitted.
- The deployment target is GitHub Pages; hosting-level concerns are GitHub's responsibility.

## Supported versions

The `main` branch (and the published GitHub Pages deployment built from it) is the only supported version.

## Best practices for contributors

- Never commit real chat exports, credentials, tokens or `.env` files (enforced by `.gitignore` and CI secret scanning).
- Add parser fixtures only as synthetic data.
- Keep the network audit (`tests/e2e/privacy.spec.ts`) passing — it guarantees no conversation content leaves the
  browser.
