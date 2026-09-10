# Documentation index

Read [agent rules](../AGENTS.md), [status](STATUS.md), and [project context](PROJECT-CONTEXT.md) before non-trivial work.

## Contracts & Architecture

- [MCP tools contract](contracts/mcp-tools.md): Arguments, results, error codes, and annotations for all 47 CampaignOS tools and bootstrap diagnostics.
- [Assets and uploads contract](contracts/assets-and-uploads.md): Hierarchy, file limits, capability token state machine, and private delivery.
- [Architecture Decision Records (ADRs)](adr/README.md):
  - [ADR 0001: Temporary Unauthenticated Fail-Closed Test Mode](adr/0001-unauthenticated-test-mode.md)
  - [ADR 0002: Shared PostgreSQL Domain Services with Transactional Audit and Concurrency](adr/0002-shared-services-and-transactional-audit.md)
  - [ADR 0003: Single-Password Boundary Authentication with Stateless Signed Sessions](adr/0003-single-password-boundary-authentication.md)
  - [ADR 0004: Private Blob Storage, Asset Revisions, and Capability Upload Links](adr/0004-asset-storage-revisions-and-upload-links.md)
  - [ADR 0005: Polymorphic Entity Tags and Directed Relationships](adr/0005-polymorphic-entity-tags-and-relations.md)
  - [ADR 0006: Internal Upload Sessions, Purpose Separation, and Shared Recovery](adr/0006-internal-upload-sessions-and-recovery.md)
  - [ADR 0007: CampaignOS Persistent Cross-Tool Memory](adr/0007-campaignos-persistent-cross-tool-memory.md)

## Runbooks & Operations

- [Local development and verification](runbooks/local-development.md): Setup, Prisma CLI, migration, seeding, unit tests, and smoke testing.
- [Asset storage and Blob cleanup](runbooks/asset-storage.md): Private Vercel Blob store provisioning, quotas, and abandoned upload cleanup CLI.
- [Backup and disaster recovery](runbooks/backup-restore.md): PostgreSQL dump/restore procedures, Blob manifest verification, and disaster recovery.
- [Manual acceptance and verification](runbooks/manual-acceptance.md): Step-by-step browser acceptance scenarios, MCP Inspector testing, upload capability flows, and release verification checklist.
- [Vercel deployment and client integration](runbooks/vercel-deployment.md): Hosting configuration, environment variables, Codex, ChatGPT, and MCP Inspector setup.
- [How Kommissar remembers (MCP usage)](runbooks/mcp-usage.md): Human-facing exposition of CampaignOS Memory, authority order, and cross-tool context.

## Project Entry Points

- [README](../README.md): Product overview, security warnings, configuration, and developer quick start.

## Historical Review Records

- [Bootstrap code review (2026-09-05)](history/bootstrap-code-review-2026-09-05.md): Review of local bootstrap commit `d5a4508`; non-current evidence, findings, and verification boundaries.
