# ADR 005 — Managed Email Relay

**Status:** accepted  
**Date:** July 2026

## Context

Rhodes needs transactional email (Knowledge Bridge, invites, password reset). Self-hosted SMTP (Postal, Mailcow) from the same VPS IP risks:
- Destroying IP reputation for HTTPS/API
- 2–4 week warmup periods
- Hetzner port 25 restrictions
- Ongoing deliverability ops

## Decision

Use a **managed email relay** via HTTPS API:
- **MVP:** Resend (shared pre-warmed IP pool)
- **Scale:** AWS SES `eu-central-1`

The VPS **never sends SMTP**. Sending subdomain: `notify.rhodes.app`.

## Consequences

**Positive:**
- App VPS IP reputation protected
- Day-one deliverability
- Bounce/complaint dashboards included

**Negative:**
- Email content/metadata leaves VPS to provider
- Monthly cost at scale (mitigated by SES pricing)
- Deliberate exception to "fully self-hosted" marketing — document honestly

## Dependencies

- [14-email-delivery.md](../14-email-delivery.md)
- [15-security-and-privacy.md](../15-security-and-privacy.md)
