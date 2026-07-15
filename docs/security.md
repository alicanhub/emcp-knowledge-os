# Security deployment guidance

The application ships a restrictive CSP meta policy and contains no inline
handlers. Production hosting should send the same policy as an HTTP response:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Only enable a remote AI or monitoring endpoint by adding its exact origin to
`connect-src`; never use a wildcard. Provider responses still pass through the
safe formatting allowlist. AI requests are bounded to 1,000 characters and ten
requests per minute, with a cooldown after bursts. Server-side providers must
also authenticate callers, enforce per-user/IP budgets, redact logs and cap
request/response sizes.

CI rejects high-severity npm audit findings, validates data schemas and generated
indexes, and Dependabot proposes weekly development-tool updates. Review lockfile
changes, browser-test the built artifact, and deploy only from a protected branch.
