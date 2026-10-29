# Security Policy

## Reporting a vulnerability

**Please don't open a public GitHub issue for a security vulnerability.** Report it privately so we can fix it before it's public knowledge.

Email: **`[TODO: add a real, monitored security contact — e.g. security@yourdomain.example]`**

> This address is a placeholder. Whoever maintains this repository needs to fill in a real inbox (and ideally enable [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) under the repo's **Security** tab) before this policy is actually actionable.

When reporting, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (a minimal repro is ideal)
- The version/commit you tested against
- Whether you're aware of it being exploited in the wild

We'll acknowledge your report as soon as we can, and keep you updated as we investigate and fix the issue. We ask that you give us a reasonable amount of time to fix a confirmed issue before any public disclosure.

## Supported versions

StryveForms doesn't yet have numbered releases or long-term support branches — treat the `main` branch as the only supported version. Once releases exist, this section will list which ones receive security fixes.

## Scope

This policy covers the StryveForms application code in this repository (`apps/*`, `packages/*`) and its official Docker images. It does not cover:

- Vulnerabilities in third-party dependencies — report those upstream (though we'd still like to hear about it so we can patch/pin a fix).
- Security issues in how *you've* deployed or configured an instance (e.g. an exposed database port, a weak `BETTER_AUTH_SECRET`, a missing reverse-proxy TLS config) — see the self-hosting section of the README.
- Social engineering, physical access, or denial-of-service reports without a concrete application-level issue behind them.

## A note on self-hosting

Because StryveForms is self-hosted, you are responsible for keeping your own instance's dependencies, base images, and host OS patched. Subscribe to repository releases (once they exist) or watch the repo to be notified of security-relevant updates.
