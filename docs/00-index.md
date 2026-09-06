# Documentation index

Read [agent rules](../AGENTS.md), [status](STATUS.md), and [project context](PROJECT-CONTEXT.md) before non-trivial work.

## Contracts & Architecture

- [MCP tools contract](contracts/mcp-tools.md): Arguments, results, error codes, and annotations for all 10 CampaignOS tools and bootstrap diagnostics.
- [Architecture Decision Records (ADRs)](adr/README.md):
  - [ADR 0001: Temporary Unauthenticated Fail-Closed Test Mode](adr/0001-unauthenticated-test-mode.md)
  - [ADR 0002: Shared PostgreSQL Domain Services with Transactional Audit and Concurrency](adr/0002-shared-services-and-transactional-audit.md)
  - [ADR 0003: Single-Password Boundary Authentication with Stateless Signed Sessions](adr/0003-single-password-boundary-authentication.md)
  - [ADR 0004: Private Blob Storage, Asset Revisions, and Capability Upload Links](adr/0004-asset-storage-revisions-and-upload-links.md)
  - [ADR 0005: Polymorphic Entity Tags and Directed Relationships](adr/0005-polymorphic-entity-tags-and-relations.md)

## Runbooks & Operations

- [Local development and verification](runbooks/local-development.md): Setup, Prisma CLI, migration, seeding, unit tests, and smoke testing.
- [Vercel deployment and client integration](runbooks/vercel-deployment.md): Hosting configuration, environment variables, Codex, ChatGPT, and MCP Inspector setup.

## Project Entry Points

- [README](../README.md): Product overview, security warnings, configuration, and developer quick start.

## Historical Review Records

- [Bootstrap code review (2026-09-05)](history/bootstrap-code-review-2026-09-05.md): Review of local bootstrap commit `d5a4508`; non-current evidence, findings, and verification boundaries.
