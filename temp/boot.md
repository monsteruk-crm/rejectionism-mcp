Build the first working version of **Rejectionism CampaignOS**: a small campaign-management application with a remote MCP server and a basic administration interface in the same Next.js/Vercel application.

Implement the application completely. Do not stop after producing a plan.

# 1. Inspect before changing anything

First:

1. Inspect the existing repository and its package manager.
2. Read any `AGENTS.md` files.
3. Inspect all supplied Rejectionism source material, particularly:

docs/sources/REJECTIONISM-WORLD-DOMINATION-HQ.md
docs/sources/THE REJECTIONIST MANIFESTO.md
    * supplied logos, banners and campaign artwork
4. Preserve existing working code and conventions.
5. If the repository is empty, scaffold a current stable Next.js App Router application using TypeScript.

Summarize what already exists before implementation, then proceed without asking unnecessary questions.

# 2. Product purpose

This is the operational headquarters for **REJECTIONISM**, the satirical art movement built around rejection.

The system must allow Alfonso and Michele to track:

* Current and upcoming work
* Blocked tasks
* Canonical campaign decisions
* Websites and domains
* Visual assets
* Contacts and collaborations
* Planned campaign content
* Evidence that work was completed
* An auditable history of changes

The same service layer and PostgreSQL database must power both:

* The `/admin` web interface
* The `/api/mcp` remote MCP server

Do not duplicate business logic between the admin and MCP implementations.

# 3. Technology

Use:

* Current stable Next.js with App Router
* TypeScript with strict mode
* React Server Components by default
* Tailwind CSS
* Prisma
* PostgreSQL
* Zod for input validation
* `mcp-handler` for the MCP server
* Vitest for focused tests
* npm, pnpm or the existing repository package manager

Use the default Node.js runtime because Prisma requires normal Node.js compatibility.

Do not add:

* Authentication
* Clerk
* NextAuth/Auth.js
* OAuth
* Redis
* An OpenAI API integration
* A chat interface
* A vector database
* Embeddings
* Multiple agents
* A separate Express/Fastify backend
* Image uploading or asset transformation

This application exposes campaign data to external AI clients; it does not run its own model.

# 4. Temporary unauthenticated mode

This initial test version intentionally has no authentication.

Add:

```env
UNAUTHENTICATED_TEST_MODE=true
```

The application must fail closed when that variable is not exactly `true`.

When disabled:

* `/admin` must show that test mode is disabled.
* MCP write operations must return a clear error.
* Do not silently allow writes.

When enabled:

* Show a conspicuous banner across `/admin`:
  `UNAUTHENTICATED TEST SYSTEM — DO NOT STORE PRIVATE OR SENSITIVE DATA`
* Include the same warning in the README.
* Never store passwords, tokens, personal bank details or sensitive personal data.
* Do not implement delete or bulk-delete MCP tools.

This is not a substitute for authentication. Mark proper authentication and authorization as the first post-MVP milestone.

# 5. Prisma data model

Create a clean Prisma schema containing these models.

## WorkItem

Fields:

* `id`
* `title`
* `description`
* `status`
* `priority`
* `dueDate`
* `blockedReason`
* `evidenceUrl`
* `version`
* `createdAt`
* `updatedAt`

Statuses:

* `BACKLOG`
* `NEXT`
* `IN_PROGRESS`
* `BLOCKED`
* `DONE`

A work item cannot move to `DONE` unless it has either an `evidenceUrl` or an explicit completion note.

## CanonEntry

Fields:

* `id`
* `key`, unique
* `value`
* `category`
* `notes`
* `version`
* `createdAt`
* `updatedAt`

Use this for authoritative names, slogans, roles and other campaign facts.

## Decision

Fields:

* `id`
* `subject`
* `decision`
* `rationale`
* `supersedesId`, optional
* `decidedAt`
* `createdAt`
* `updatedAt`

Preserve old decisions. Superseded decisions must remain visible.

## Asset

Fields:

* `id`
* `name`
* `kind`
* `status`
* `sourceFilename`
* `url`
* `notes`
* `version`
* `createdAt`
* `updatedAt`

Asset statuses:

* `MISSING`
* `DRAFT`
* `NEEDS_WORK`
* `APPROVED`
* `SUPERSEDED`

For this MVP, assets are records containing filenames and URLs. Do not implement file uploading.

## Website

Fields:

* `id`
* `name`
* `domain`, unique
* `purpose`
* `status`
* `repositoryUrl`
* `deploymentUrl`
* `notes`
* `version`
* `createdAt`
* `updatedAt`

Website statuses:

* `PLANNED`
* `RESERVED`
* `IN_PROGRESS`
* `LIVE`
* `REDIRECT`
* `UNKNOWN`

## Contact

Fields:

* `id`
* `name`
* `organization`
* `role`
* `email`, optional
* `status`
* `notes`
* `createdAt`
* `updatedAt`

Do not seed private contact details.

## ContentItem

Fields:

* `id`
* `title`
* `format`
* `channel`
* `status`
* `scheduledFor`
* `publishedUrl`
* `notes`
* `version`
* `createdAt`
* `updatedAt`

## Activity

Fields:

* `id`
* `entityType`
* `entityId`
* `action`
* `summary`
* `metadata`, optional JSON
* `createdAt`

Every successful mutation from either the admin or MCP must create an Activity record in the same database transaction.

Use integer versions for optimistic concurrency. Updates must receive `expectedVersion`; reject stale updates with a clear conflict result rather than silently overwriting newer data.

Create and commit a proper Prisma migration. Do not rely only on `prisma db push`.

# 6. Seed canonical Rejectionism data

Create an idempotent Prisma seed script.

Seed at least these canon entries:

* Movement: `REJECTIONISM`
* Main slogan: `The art movement nobody applied for.`
* Latin slogan: `AD NIHILUM`
* Italian name: `RIFIUTAZIONISMO`
* Founders: `Alfonso and Michele`
* Michele’s title: `The Grand Architect of No`
* Papal name: `Pope Rejectus IV`
* Papal style: `His Holiness Pope Rejectus IV, Supreme Pontiff of the Holy Rejection and Vicar of the Unshortlisted`
* Papal motto: `Applica et Reicere.`
* Papal sign-off: `E se lo dice Papa Rejectus...`

Seed these websites:

* `rejectionism.co.uk`
* `archiveofno.com`
* `mor-gov.org`
* `dor-gov.co.uk`

Derive their purposes and known statuses from the HQ document. If a status is not confirmed, use `UNKNOWN`; never invent ownership, deployment or renewal facts.

Seed the current “next ten moves” from the HQ document as work items. Preserve their order using priority values.

Seed records for supplied visual assets. Clearly distinguish available assets from visuals listed as missing in the HQ.

Running the seed repeatedly must update stable seed records without creating duplicates.

# 7. Shared service layer

Put database operations and business rules in a shared server-only service layer, for example:

```text
src/server/campaign/
  work-items.ts
  canon.ts
  decisions.ts
  assets.ts
  websites.ts
  content.ts
  activity.ts
  schemas.ts
```

Both Server Actions and MCP tools must call these functions.

Requirements:

* Validate all inputs with Zod.
* Return typed results.
* Use Prisma transactions for mutations plus Activity creation.
* Implement optimistic concurrency.
* Keep Prisma imports out of Client Components.
* Avoid a generic repository abstraction that merely hides Prisma without adding business value.

# 8. Remote MCP server

Create:

```text
app/api/mcp/route.ts
```

Use Vercel’s current `mcp-handler` package and expose Streamable HTTP at:

```text
/api/mcp
```

Export the handler for `GET`, `POST` and `DELETE` as required by `mcp-handler`.

Do not enable legacy SSE and do not add Redis.

Give the MCP server concise global instructions explaining:

* CampaignOS is the authoritative operational record for Rejectionism.
* Read current data before proposing changes.
* Never report an operation as successful unless the tool confirms it.
* Preserve superseded decisions rather than deleting them.
* Require evidence before completing work.
* “World domination” means cultural reach and participation, never coercion or illegal activity.

Expose these tools:

## `campaign_get_status`

Read-only.

Return:

* Counts by work-item status
* Current in-progress work
* Blocked work
* Next three work items
* Missing assets
* Website status summary
* Most recent decisions
* Latest activity

## `campaign_list_work_items`

Read-only.

Filters:

* Status
* Minimum priority
* Due before
* Text search

## `campaign_create_work_item`

Write operation.

Create a work item and Activity entry.

## `campaign_update_work_item`

Write operation.

Accept:

* Work-item ID
* Fields being changed
* `expectedVersion`
* Optional completion note

Reject stale versions. Enforce completion evidence.

## `campaign_get_canon`

Read-only.

Support fetching all canon entries, a category, or a specific key.

## `campaign_record_decision`

Write operation.

Record a decision, optionally supersede an earlier decision, update a related canon entry when explicitly requested, and create Activity records transactionally.

Do not infer that every decision changes canon. Require an explicit `updateCanon` input.

## `campaign_list_assets`

Read-only.

Filter by status and kind.

## `campaign_register_asset`

Write operation.

Create or update asset metadata using optimistic concurrency.

## `campaign_list_websites`

Read-only.

Return domains, purposes, known status and outstanding gaps.

## `campaign_activity_feed`

Read-only.

Return recent auditable changes with an optional entity-type filter and limit.

For every tool:

* Use action-oriented descriptions explaining when the model should use it.
* Provide strict input schemas.
* Provide stable structured output.
* Mark genuinely read-only tools with the appropriate MCP `readOnlyHint`.
* Do not mark write tools as read-only.
* Return useful error codes for validation, not found, version conflict and test mode disabled.
* Never expose stack traces or environment variables.

# 9. Basic administration interface

Create a functional `/admin` interface using the established Rejectionism visual language:

* Red, black and warm off-white
* Strong constructivist typography and geometry
* Clear hierarchy
* Serious administrative dashboard crossed with absurd government propaganda
* Responsive and usable, not merely decorative

Do not spend time building elaborate animations.

The admin must include:

## Dashboard

Show:

* Now
* Next
* Blocked
* Missing assets
* Website status
* Recent decisions
* Recent activity

Provide direct links to the relevant management screens.

## Work items

* Filter by status
* Create work item
* Edit work item
* Move between statuses
* Record blocked reason
* Add evidence and complete work
* Clearly show priority, version and last update

## Canon and decisions

* View canonical entries
* Add or edit canon entries
* Record decisions
* Show superseded decisions without deleting history

## Assets

* List and filter assets
* Register filename or URL
* Change status
* Record notes and versions
* Clearly identify missing assets

## Websites

* List all domains
* Edit purpose, status, repository URL, deployment URL and notes

## Content

* Basic list and edit screens for campaign content
* Support draft, scheduled and published states

Use Server Components for initial reads and Server Actions for admin mutations. Add Client Components only where interaction genuinely requires them.

Use accessible semantic HTML, labelled controls, keyboard-operable interactions, visible focus states and sufficient colour contrast.

# 10. Supporting routes

Add:

```text
GET /api/health
```

Return:

* Application status
* Database connectivity
* Current timestamp
* Whether unauthenticated test mode is enabled

Do not expose secrets or the database URL.

# 11. Testing

Add focused tests for:

* Work-item completion evidence rule
* Optimistic concurrency conflicts
* Decision supersession
* Canon updates only when explicitly requested
* Activity records created with mutations
* Test mode disabling writes
* MCP input validation
* Idempotent seed behaviour where practical

Add at least one integration test proving that data created through the service layer appears in the status result used by MCP.

Do not create meaningless snapshot tests.

# 12. Developer experience

Provide:

* `.env.example`
* Prisma migration
* Seed command
* Useful npm scripts
* README
* Clear local setup
* Clear Vercel deployment instructions
* MCP Inspector testing instructions
* Example Codex MCP configuration
* Example ChatGPT developer-mode connection instructions
* Example calls for each MCP tool
* Security limitations section
* “Authentication is the next mandatory milestone” section

Expected environment variables:

```env
DATABASE_URL=
UNAUTHENTICATED_TEST_MODE=true
```

Make sure `prisma generate` runs where required for Vercel builds.

Do not commit `.env`, credentials or generated database contents.

# 13. Verification

Before finishing:

1. Run the formatter.
2. Run lint.
3. Run TypeScript type checking.
4. Run tests.
5. Run Prisma validation.
6. Run the production build.
7. Start the application locally.
8. Verify `/admin`.
9. Verify `/api/health`.
10. Connect MCP Inspector to `/api/mcp`.
11. List the MCP tools.
12. Execute at least one read tool.
13. Execute a reversible write tool.
14. Confirm that the write appears in `/admin`.
15. Confirm that an Activity record was created.

Fix discovered failures rather than merely documenting them.

# 14. Final report

Finish with:

* What was implemented
* Important architectural choices
* Database migration and seed status
* MCP endpoint URL
* Admin URL
* Verification commands and results
* Remaining limitations
* Exact environment variables required
* The next step for adding authentication

Do not claim a check passed unless you actually ran it.
