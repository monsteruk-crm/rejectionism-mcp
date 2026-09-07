# Rejectionism CampaignOS functional release runbook

This runbook is for completing and validating functionality before the separate security-hardening pass. It supports local, disposable-test, and staging use only. Do not treat it as approval for broad production access before the security runbook is complete.

## 1. Establish the test boundary

Record:

- commit SHA
- tester
- date/time
- environment: local, disposable test, or staging
- database classification: disposable test database only for write tests
- Blob storage classification: test/staging only for upload tests

Do not record passwords, tokens, database URLs, or raw capability-upload links.

Stop immediately if any write test might target production or an unidentified database.

## 2. Configuration preflight

Confirm required configuration exists without displaying values:

- application database
- separate disposable integration-test database
- admin login configuration
- MCP client configuration
- Blob configuration
- canonical application URL

Confirm these routes are reachable in the intended environment:

- `/login`
- `/admin`
- `/admin/assets`
- `/admin/assets/upload`
- `/admin/upload-links`
- `/api/mcp`
- `/mcp`, while compatibility remains supported
- `/upload/[token]`

Confirm the seed policy before running any seed command. Determine whether it creates demo records, updates existing records, or is limited to disposable fixtures.

## 3. Automated quality gates

Run and capture the final result of each:

- format check
- type-check
- lint
- unit tests
- Prisma schema validation
- integration suite against a confirmed disposable database
- production build
- local MCP smoke client against `/api/mcp`
- parity smoke client against `/mcp`
- browser/E2E suite

Do not accept partial output as a pass. Capture each command’s exit result.

## 4. Admin acceptance test

Use a clean browser session.

### Authentication and navigation

- Open `/admin` logged out; confirm the expected login behaviour.
- Test invalid login feedback and valid login.
- Confirm logout works and protected pages are inaccessible afterward.
- Confirm desktop, narrow mobile, keyboard navigation, focus visibility, and form submission work.

### Dashboard and registers

For each area, test list/search, create, validation failure, edit, conflict handling, and activity/audit visibility:

- work items
- canon
- decisions
- assets
- websites
- content
- contacts
- tags
- relationships
- upload links

Confirm:

- inline errors preserve entered values
- success feedback is clear
- version conflicts can be recovered without losing work
- list/selector searching works beyond the first 100 records
- relationship creation uses searchable records rather than raw IDs
- incompatible relationship types cannot be selected
- lifecycle rules—supersede, correct, archive, or restore—are understandable

## 5. Asset and upload acceptance test

### Internal admin upload

- Confirm “Upload Assets” is visible from navigation and dashboard.
- Upload valid supported image, audio, video, document, and generic-file samples.
- Reject an unsupported type, oversized file, renamed file, malformed file, and duplicate checksum.
- Test every registration route:
    - new asset
    - new revision
    - new representation
    - set primary representation
    - attach to an existing asset
- Confirm asset metadata, rights fields, visibility, asset family, version lineage, and activity are accurate.
- Confirm internal uploads do not pollute contributor upload-link management.

### Contributor upload links

Only use staging/disposable links.

- Create a link.
- Upload a permitted file.
- Verify completed registration.
- Test expiry, revocation, reset/regeneration, invalid token, maximum-upload behaviour, and interrupted-upload recovery.
- Confirm the contributor cannot access admin pages.
- Confirm the admin can inspect link status and resulting assets.

### Cleanup

- Run upload cleanup in dry-run mode.
- Confirm candidate records are understandable.
- Create marked disposable orphan fixtures only.
- Run controlled apply mode.
- Confirm only expected objects/records are affected.

## 6. MCP complete functional matrix

Run against `/api/mcp` using a disposable test database. Repeat endpoint-parity checks against `/mcp`.

First verify the exact tool inventory and common metadata. Then test each family:

| Family | Functional checks |
|---|---|
| Bootstrap | echo and database health |
| Status/activity | normal, empty, filtered, invalid input |
| Work items | list, get, create, update, status change, conflict |
| Canon | get, create, update, expected-version conflict |
| Decisions | list, get, record, optional canon update |
| Assets | list, get, create, update, revisions, representations, primary selection |
| Upload links | create, list, get, revoke, regenerate |
| Websites | list, get, create, update |
| Content | list, get, create, update |
| Contacts | list, get, create, update |
| Tags/relations | create/list tags and create/list valid relations |
| Search | every entity type, escaped text, empty result, pagination |

For every mutation, confirm:

- correct returned record/status
- useful validation response
- not-found response
- optimistic-concurrency behaviour
- activity entry
- fixture cleanup or disposable-environment isolation

Do not create real contributor links or touch live campaign records during smoke tests.

## 7. Staging gate

After local/disposable tests pass:

- Deploy or use the authorised staging deployment.
- Confirm real staging admin login and normal navigation.
- Confirm deployed `/api/mcp` and `/mcp` return parity behaviour.
- Confirm database writes reach staging only.
- Perform one controlled real Blob upload and private retrieval path.
- Run cleanup dry-run only unless staging cleanup ownership is explicit.
- Confirm logs are usable for diagnosing failures.
- Confirm rollback, backup, and recovery documentation is available.

## 8. Functional release decision

Approve controlled internal/staging use only when:

- every automated gate passes
- every admin register workflow passes
- every asset/upload path passes
- the complete MCP matrix passes
- canonical and legacy MCP routes behave consistently
- staging verifies real database and Blob behaviour
- no test targeted production unintentionally
- unresolved items are documented with owner and target date

Create a follow-up security-hardening task using the dedicated security prompt before opening the service to broader users, sharing MCP credentials widely, or treating the system as production-hardened.