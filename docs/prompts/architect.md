Review the implementation prompt below as a senior software architect preparing work for a substantially cheaper and less capable coding model.

Your task is NOT to implement anything.

Your task is to transform the specification into a SIMPLE, DETERMINISTIC, UNAMBIGUOUS EXECUTION PLAN that another model can follow almost mechanically.

Assume the execution model:
- is competent at TypeScript / Next.js / Prisma
- can inspect the repository
- can edit multiple files
- can run tests
- is significantly worse at architecture, product interpretation, and resolving ambiguity
- should therefore be required to make as few design decisions as possible

IMPORTANT PRINCIPLE:

YOU make the architectural and sequencing decisions now.

Do not leave questions such as:
"choose an appropriate model"
"use whichever approach is best"
"consider adding..."
"if useful..."
"you may..."
"something like..."

Resolve those decisions yourself and state exactly what the execution model should do.

Review the original prompt for:
- contradictions
- underspecified behavior
- unnecessary complexity
- missing edge cases
- dangerous implementation choices
- dependencies between milestones
- migration/backwards-compatibility problems
- security mistakes
- places where two different implementations could reasonably result

Where ambiguity exists, choose the simplest implementation that:
1. preserves the existing CampaignOS architecture,
2. satisfies the requested behavior,
3. is easy to test,
4. does not create unnecessary infrastructure.

Do not silently drop requirements.

If a requirement is a bad idea, explicitly replace it with a safer/simple equivalent and explain the change briefly before the execution plan.

Then produce an execution plan with the following exact structure.

# 1. FINAL ARCHITECTURE DECISIONS

State all decisions the implementation model must treat as fixed.

Examples:
- exact authentication mechanism
- exact cookie/session strategy
- exact MCP authentication strategy
- exact Prisma models/enums/relations
- exact Vercel Blob upload strategy
- exact UploadRequest lifecycle
- exact meaning of Asset / AssetRevision / AssetRepresentation
- exact handling of external-link-only assets
- exact generic tagging/relationship strategy
- exact global-search implementation

Do not provide alternatives.

# 2. DATABASE CHANGES

Give the exact Prisma changes.

For every new model and enum provide:
- model/enum name
- fields
- types
- nullability
- defaults
- uniqueness constraints
- indexes
- relationships
- delete behavior where relevant

State exactly how existing Asset rows are migrated without losing current data.

State clearly which existing fields stay, which become legacy compatibility fields, and whether any are removed.

# 3. IMPLEMENTATION ORDER

Break the project into numbered phases that MUST be executed sequentially.

Keep phases small enough that each phase leaves the project buildable/testable.

For each phase provide:

PHASE N — <name>

Goal:
One sentence.

Files/areas to inspect first:
Exact current paths.

Files likely to add:
Exact proposed paths.

Files likely to modify:
Exact current paths.

Implementation steps:
Numbered, concrete actions.

Rules/invariants:
Things the implementation must not violate.

Tests to add:
Exact behaviors to test.

Verification:
Exact commands to run.

Exit condition:
A binary statement of what must be true before proceeding.

Do not tell the implementation model to work on later phases until the current phase passes its exit condition.

# 4. MCP TOOL CONTRACT

Give the final exact list of MCP tools after this work.

For every new tool specify:
- exact tool name
- read/write classification
- purpose
- input schema in pseudo-TypeScript/Zod form
- important output fields
- whether it is idempotent
- whether it is destructive

Identify existing tools that remain unchanged, are extended, or become deprecated.

Do not let the execution model invent MCP names or schemas.

# 5. ROUTES AND UI

Give the exact intended routes.

For example:

/login
/admin/assets
/admin/assets/[id]
/admin/upload-links
/admin/upload-links/[id]
/admin/search
/upload/[token]

For each route state:
- authentication requirement
- purpose
- primary actions
- important states/errors

Be explicit about the public upload flow.

# 6. PUBLIC UPLOAD STATE MACHINE

Write the exact UploadRequest lifecycle/state machine.

Include:
- creation
- token generation
- token hashing
- validation
- expiry
- revocation
- Blob upload authorization
- multi-file upload
- external link items
- finalization
- transactional persistence
- consumed-link behavior
- error/retry behavior

Resolve exactly what happens if:
- Blob upload succeeds but finalization fails
- only some files upload successfully
- an expired link is opened
- a revoked link is opened
- a consumed link is reused
- an external URL is invalid
- maxItems is exceeded

The execution model must not invent these rules.

# 7. ASSET RULES

State exact semantics for:

Asset
AssetRevision
AssetRepresentation

Explain exactly what constitutes:
- a new Asset
- a new revision
- another representation of an existing revision

Define the behavior of the three UploadRequest targeting modes:
- no target
- targetAssetId
- targetRevisionId

Define how existing legacy assets behave after migration.

# 8. SECURITY RULES

Turn all security requirements into explicit implementation checks.

Include:
- password handling
- session cookie
- MCP Bearer token
- upload capability tokens
- Vercel Blob secrets
- server-side action protection
- public upload isolation
- allowed external URLs
- filename/path handling
- MIME/size validation
- secret/log handling

Avoid generic advice. State what code must enforce.

# 9. TEST MATRIX

Produce a compact matrix:

Feature | Test | Expected result

Cover all important normal and failure paths.

Separate:
- unit tests
- database integration tests
- MCP smoke tests
- manual browser acceptance tests

# 10. FINAL EXECUTION CHECKLIST

Produce a chronological checklist that the cheaper implementation model can literally tick off.

Every item must be binary and actionable.

For example:

[ ] Update Prisma schema
[ ] Author migration
[ ] Run db:validate
[ ] Add auth service
[ ] Add auth tests
...

Finish with:

[ ] pnpm db:validate
[ ] pnpm db:generate
[ ] pnpm type-check
[ ] pnpm lint
[ ] pnpm test
[ ] pnpm test:integration
[ ] pnpm build
[ ] pnpm format:check

# 11. DO NOT IMPROVISE

End the plan with a short section listing decisions that the implementation model must NOT change without stopping and reporting a blocker.

The resulting document should be detailed enough that a cheaper model can execute it without redesigning the system.

Prefer boring explicit implementation over clever abstractions.

Keep the existing shared architecture:

Admin / MCP
-> shared lib/campaign services
-> Prisma/PostgreSQL

Do not implement code yet.

Here is the original implementation specification:

--- BEGIN ORIGINAL PROMPT ---

[PASTE THE FULL PROMPT HERE]

--- END ORIGINAL PROMPT ---