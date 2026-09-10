PURPOSE

Test CampaignOS end-to-end using two independent interfaces:

A. HUMAN
The founder uses the CampaignOS Admin interface in a browser.

B. AGENT
An MCP-connected agent uses the CampaignOS MCP API.

The test must demonstrate that both interfaces operate on the same persistent
CampaignOS state.

This is an INTERACTIVE test.

The agent must guide the human ONE STEP AT A TIME.

DO NOT dump the entire test procedure at the user and ask them to report back
at the end.

For every test:

1. Agent explains the next human action.
2. Human performs it.
3. Human confirms what they see.
4. Agent verifies the resulting state through MCP.
5. Agent records PASS / FAIL.
6. Only then proceed.

If something fails:

STOP that test.
Record:
- expected
- actual
- UI symptoms
- MCP result/error
- whether data changed
- likely layer involved

Do not continue blindly and compound corrupted test state.

============================================================
TEST SESSION RULES
============================================================

Use a unique test prefix for all disposable records.

At the beginning create something like:

    TEST-20260910-0835

Call this:

    TEST_PREFIX

Every disposable test entity must include TEST_PREFIX.

Example:

    TEST-20260910-0835 Work Item
    TEST-20260910-0835 Asset
    TEST-20260910-0835 Contact

This makes test data easy to find and clean up/archive later.

DO NOT modify important real Canon or production campaign records unless the
test specifically requires reading them.

Prefer creating disposable test records.

Never put:

- real passwords
- API tokens
- bank details
- private credentials

into test records.

============================================================
PHASE 0 — CONNECTION AND ENVIRONMENT
============================================================

AGENT:

Confirm MCP is connected.

Call the minimal read-only diagnostics available in the current MCP.

Verify:

- MCP endpoint responds
- authentication succeeds
- database connectivity succeeds
- campaign_get_status succeeds

Record:

MCP CONNECTION ........ PASS / FAIL
DATABASE .............. PASS / FAIL
CAMPAIGN STATUS ....... PASS / FAIL

Then tell the human to open CampaignOS.

HUMAN:

Open:

    /admin

EXPECTED:

If not logged in:
redirected to /login

If already authenticated:
dashboard opens

Do not proceed until Admin and MCP are both available.

============================================================
PHASE 1 — AUTHENTICATION
============================================================

TEST 1.1 — ADMIN LOGIN

HUMAN:

Log out if already logged in.

Visit:

    /admin

EXPECTED:

Redirect to:

    /login

Enter an invalid password.

EXPECTED:

Login rejected.
No Admin access.

Enter correct password.

EXPECTED:

Login succeeds.
Admin dashboard appears.

AGENT:

Verify MCP still works independently.

PASS if:
- invalid Admin password fails
- valid password succeeds
- MCP connection remains functional

------------------------------------------------------------
TEST 1.2 — SESSION

HUMAN:

Navigate between several Admin pages.

EXPECTED:

No repeated login prompts.

Refresh page.

EXPECTED:

Session persists.

------------------------------------------------------------
TEST 1.3 — LOGOUT

HUMAN:

Use Logout.

Visit /admin again.

EXPECTED:

Redirect to login.

Log back in to continue.

============================================================
PHASE 2 — DASHBOARD
============================================================

HUMAN:

Open:

    /admin

Read the main dashboard counters.

AGENT:

Call:

    campaign_get_status

Compare meaningful values such as:

- work item counts
- blocked items
- missing assets
- websites
- recent activity

Exact presentation can differ.

Underlying state must agree.

PASS / FAIL.

============================================================
PHASE 3 — WORK ITEMS
============================================================

TEST 3.1 — CREATE THROUGH HUMAN UI

HUMAN:

Create:

    <TEST_PREFIX> Work Item

Description:

    Interactive acceptance test work item.

Priority:

    77

Status:

    BACKLOG

AGENT:

Search/list Work Items.

Verify:

- title
- description
- priority
- status

PASS / FAIL.

------------------------------------------------------------
TEST 3.2 — MODIFY THROUGH MCP

AGENT:

Use the Work Item's current version.

Change:

    status -> IN_PROGRESS

HUMAN:

Refresh/open the Work Item in Admin.

EXPECTED:

Status now IN_PROGRESS.

PASS / FAIL.

------------------------------------------------------------
TEST 3.3 — BLOCKED VALIDATION

Attempt to move the item to BLOCKED without blockedReason.

EXPECTED:

Rejected.

Then provide:

    blockedReason:
    "Intentional acceptance-test blocker."

EXPECTED:

Accepted.

Human verifies UI.

------------------------------------------------------------
TEST 3.4 — DONE EVIDENCE RULE

Attempt DONE without:

- evidenceUrl
- completionNote

EXPECTED:

Rejected.

Then set:

    completionNote:
    "Completed during interactive CampaignOS acceptance test."

EXPECTED:

DONE accepted.

Verify through UI and MCP.

============================================================
PHASE 4 — OPTIMISTIC CONCURRENCY
============================================================

This test is important.

AGENT:

Read a disposable mutable record and note:

    version = N

HUMAN:

Edit that same record through Admin.

AGENT:

Attempt an update using stale:

    expectedVersion = N

EXPECTED:

VERSION_CONFLICT.

Agent must NOT silently overwrite newer data.

Then:

1. re-read current record
2. obtain new version
3. apply an intentional valid update

EXPECTED:

Success.

PASS only if stale writes are rejected.

============================================================
PHASE 5 — CANON
============================================================

Do NOT alter important real Canon.

TEST 5.1

HUMAN or AGENT:

Create a disposable Canon entry if Admin supports creation:

    key:
    test.<TEST_PREFIX>.motto

    value:
    The Ministry Rejects This Test

    category:
    TEST

AGENT:

Retrieve it through Canon MCP tools.

Verify exact value.

------------------------------------------------------------
TEST 5.2

Update it through whichever interface was NOT used to create it.

Verify change from the other interface.

PASS / FAIL.

============================================================
PHASE 6 — DECISIONS
============================================================

Create:

Subject:

    <TEST_PREFIX> Acceptance Test Decision

Decision:

    Use the red test stamp.

Rationale:

    Created solely to verify Decision persistence.

AGENT:

Retrieve/relevant search.

Verify:

- subject
- decision
- rationale
- timestamp

Then test supersession if supported conveniently.

Create a second Decision:

    Use the black test stamp.

Supersede first.

EXPECTED:

- first remains historically present
- second is current successor
- history is preserved

PASS / FAIL.

============================================================
PHASE 7 — ASSET LIBRARY
============================================================

This phase exercises the new DAM.

TEST 7.1 — CREATE CONCEPTUAL ASSET

HUMAN:

Open:

    /admin/assets

Create:

    <TEST_PREFIX> Ministry Test Logo

kind:

    LOGO

or closest supported kind.

AGENT:

Find asset through MCP.

Verify metadata.

------------------------------------------------------------
TEST 7.2 — FILE REPRESENTATIONS

Prepare 2–3 harmless small files.

For example:

    test-logo.svg
    test-logo.png
    test-logo.pdf

HUMAN:

Upload them as representations of the same Asset/revision.

EXPECTED:

Asset detail shows multiple representations.

AGENT:

Call campaign_get_asset.

Verify:

- Asset exists
- revision exists
- representations exist
- storage type = BLOB
- filenames/formats present
- URLs present where appropriate

PASS / FAIL.

------------------------------------------------------------
TEST 7.3 — REVISION

Create a new revision for the test Asset.

Upload another representation.

EXPECTED:

Revision 1 remains.
Revision 2 appears separately.

AGENT:

Verify both revisions through MCP.

PASS only if previous files were NOT overwritten.

============================================================
PHASE 8 — EXTERNAL-LINK-ONLY ASSET
============================================================

HUMAN:

Create:

    <TEST_PREFIX> Giant Video Master

Do NOT upload a file.

Add an external URL such as a harmless test HTTP/HTTPS URL.

Label:

    External master

EXPECTED:

Asset is valid with:

    storageType = EXTERNAL_URL

AGENT:

Retrieve Asset.

Verify external representation exists.

No Blob representation should be required.

PASS / FAIL.

============================================================
PHASE 9 — PUBLIC UPLOAD LINKS
============================================================

This is one of the highest-value tests.

TEST 9.1 — CREATE THROUGH MCP

AGENT:

Create upload request:

Title:

    <TEST_PREFIX> Vector Logo Request

Instructions:

    Please upload the test logo in vector format and any accompanying preview.

Expiry:

    7 days

Max items:

    5

Return public URL.

Agent gives URL to human.

------------------------------------------------------------
TEST 9.2 — PUBLIC ACCESS

HUMAN:

Open the URL in:

    private/incognito window

Do NOT authenticate to CampaignOS.

EXPECTED:

Upload page opens.

EXPECTED NOT TO HAPPEN:

- access to /admin
- campaign data exposure
- unrelated assets displayed

------------------------------------------------------------
TEST 9.3 — MULTI-ASSET SUBMISSION

HUMAN:

Add:

    sample-vector.svg
    sample-preview.png

and one external URL item.

Submit all THREE together.

EXPECTED:

One successful finalized submission.

AGENT:

Inspect UploadRequest and resulting assets/representations.

Verify all three submitted items are present.

Verify UploadRequest is SUBMITTED/consumed.

------------------------------------------------------------
TEST 9.4 — REUSE

HUMAN:

Try opening/submitting through the same link again.

EXPECTED:

Consumed link cannot create another submission.

PASS / FAIL.

============================================================
PHASE 10 — REVOKED UPLOAD LINK
============================================================

AGENT:

Create another upload request.

Then revoke it.

HUMAN:

Open link.

EXPECTED:

Clearly rejected/revoked.

No upload possible.

PASS / FAIL.

============================================================
PHASE 11 — MEMORY
============================================================

This tests actual cross-tool persistence.

TEST 11.1 — CREATE VIA MCP

AGENT:

Call campaign_remember with:

key:
test.<TEST_PREFIX>.visual-style

title:
Acceptance test visual preference

content:
Acceptance-test posters should use an intentionally oversized hash symbol.

category:
STYLE

importance:
82

tags:
["test", "visual"]

EXPECTED:

CREATED.

------------------------------------------------------------
TEST 11.2 — HUMAN BACK-OFFICE

HUMAN:

Open:

    /admin/memory

Find the memory.

Verify:

- title
- content
- category
- importance
- tags
- provenance/source
- ACTIVE state

Open detail page.

EXPECTED:

Metadata and relationships sections visible.

PASS / FAIL.

------------------------------------------------------------
TEST 11.3 — PIN

HUMAN:

Pin the memory.

AGENT:

Retrieve it.

EXPECTED:

pinned = true.

------------------------------------------------------------
TEST 11.4 — SMART RECALL

AGENT:

Call:

    campaign_recall

with a query such as:

    "How should I design the acceptance test poster?"

EXPECTED:

Test memory appears with:

- relevance score
- relevance reasons

PASS / FAIL.

------------------------------------------------------------
TEST 11.5 — DUPLICATE PREVENTION

AGENT:

Attempt to remember EXACTLY the same memory again.

EXPECTED:

No second row.

Result should indicate something like:

    DUPLICATE

or:

    ALREADY_CURRENT

Verify through Admin that only one current record exists.

------------------------------------------------------------
TEST 11.6 — SUPERSESSION

Create a replacement:

    Acceptance-test posters should use a tiny hash symbol.

Explicitly supersede the old memory.

HUMAN:

Verify:

- old memory remains visible as SUPERSEDED
- new memory ACTIVE
- history connects them

PASS / FAIL.

============================================================
PHASE 12 — CAMPAIGN CONTEXT
============================================================

AGENT:

Call:

    campaign_get_context

with:

    task:
    "Prepare the acceptance-test visual campaign"

EXPECTED:

Compact response.

It should include relevant information from several CampaignOS systems when
available, especially the test Memory.

It must NOT return the whole database.

Verify that:

- current Canon is treated as more authoritative than conflicting Memory
- superseded memories are not presented as current guidance

PASS / FAIL.

============================================================
PHASE 13 — TAGS
============================================================

Create/use tag:

    <TEST_PREFIX>-test

Attach it to at least:

- Asset
- Work Item
- Memory

Use a mixture of Admin and MCP operations.

AGENT:

Retrieve each entity.

EXPECTED:

Same tag visible.

HUMAN:

Open detail pages.

EXPECTED:

Same associations visible.

Attempt duplicate attachment.

EXPECTED:

No duplicate association.

PASS / FAIL.

============================================================
PHASE 14 — ENTITY RELATIONSHIPS
============================================================

Create relationships such as:

Work Item
RELATES_TO
Asset

Memory
RELATES_TO
Asset

Decision
RELATES_TO
Work Item

AGENT:

Retrieve relationships.

HUMAN:

Verify through relevant Admin detail pages.

EXPECTED:

Relationships persist.

Attempt exact duplicate relationship.

EXPECTED:

Duplicate prevented.

PASS / FAIL.

============================================================
PHASE 15 — WEBSITES
============================================================

Create a disposable Website record if creation is supported.

Example:

Name:
<TEST_PREFIX> Website

Domain:
test-<unique>.example.com

Purpose:
CampaignOS acceptance test.

Use Admin for create.

AGENT:

Retrieve/list via MCP.

Then update through MCP.

HUMAN:

Verify update.

PASS / FAIL.

Do not change real Rejectionism domain records unnecessarily.

============================================================
PHASE 16 — CONTENT
============================================================

Create:

    <TEST_PREFIX> Ministry Announcement

Format:
POST

Channel:
TEST

Status:
DRAFT

AGENT:

Retrieve through MCP.

Change a harmless field or status through MCP.

HUMAN:

Verify Admin reflects it.

PASS / FAIL.

============================================================
PHASE 17 — CONTACTS
============================================================

Use fake data ONLY.

Create:

Name:
TEST Ada Rejected

Organization:
Bureau of Failed Applications

Email:
ada.rejected@example.com

Status:
TEST / PROSPECT as permitted

AGENT:

Retrieve via MCP.

Update harmless metadata.

HUMAN:

Verify.

PASS / FAIL.

============================================================
PHASE 18 — GLOBAL SEARCH
============================================================

HUMAN:

Use Admin global search for:

    <TEST_PREFIX>

EXPECTED:

Results from several entity types.

AGENT:

Call:

    campaign_search

with same query.

Expected results should include a meaningful subset of:

- Work Item
- Canon
- Decision
- Asset
- Website
- Content
- Contact
- CampaignMemory

Open several Admin search-result links.

EXPECTED:

Correct destination detail page.

PASS / FAIL.

============================================================
PHASE 19 — ACTIVITY / AUDIT
============================================================

AGENT:

Read Activity feed.

Find entries produced during the test.

Verify mutations such as:

- Work Item created/updated
- Decision recorded
- Asset/revision created
- upload request created
- memory created/updated/superseded
- tag attached
- relationship created

Simple reads should NOT create excessive audit records.

HUMAN:

Compare with Admin Activity display where available.

PASS / FAIL.

============================================================
PHASE 20 — MCP / ADMIN PARITY
============================================================

Agent now performs a parity review.

For every major Admin domain:

    Work Items
    Canon
    Decisions
    Assets
    Upload Links
    Websites
    Content
    Contacts
    Memory
    Tags
    Relationships
    Search

Record whether the MCP provides the necessary read/write operations expected
from the specification.

Use:

    FULL
    READ-ONLY BY DESIGN
    PARTIAL
    MISSING

Do not count intentionally human-only presentation features as MCP failures.

============================================================
PHASE 21 — PUBLIC SECURITY BOUNDARY
============================================================

Using an unauthenticated/private browser:

Verify:

    /admin
        requires authentication

    /admin/memory
        requires authentication

    valid /upload/<token>
        permits ONLY scoped upload request

    invalid /upload/<token>
        fails safely

Agent verifies:

MCP without valid Bearer credentials should fail with 401.

Never print the actual password/token in the test report.

PASS / FAIL.

============================================================
PHASE 22 — MEMORY CROSS-CLIENT TEST
============================================================

This should ideally be performed with TWO different MCP clients.

CLIENT A:

Create a unique Memory:

    <TEST_PREFIX> CROSS CLIENT MEMORY

Content:

    The secret acceptance-test word is RIFIUTAZIONE.

Disconnect Client A.

CLIENT B:

Without receiving Client A's conversation history, call:

    campaign_recall

or:

    campaign_get_context

for:

    "What is the acceptance-test secret word?"

EXPECTED:

CampaignOS returns the stored memory.

PASS.

This is the definitive proof that CampaignOS, rather than client chat history,
is acting as shared persistent memory.

============================================================
PHASE 23 — HEALTH / FAILURE BEHAVIOUR
============================================================

Do not deliberately damage production infrastructure.

Exercise only safe errors.

Test:

- nonexistent entity ID
- stale expectedVersion
- invalid enum/status
- malformed URL
- expired/revoked upload link
- duplicate memory
- duplicate relation
- invalid relationship target

EXPECTED:

Structured meaningful errors.

No raw SQL/database exception exposed.

No false success.

PASS / FAIL.

============================================================
PHASE 24 — HUMAN BACK-OFFICE WALKTHROUGH
============================================================

Now perform a pure human UX walkthrough.

HUMAN visits each primary Admin area:

[ ] Dashboard
[ ] Work Items
[ ] Canon
[ ] Decisions
[ ] Assets
[ ] Upload Links
[ ] Websites
[ ] Content
[ ] Contacts
[ ] Memory
[ ] Global Search

For each screen answer:

1. Can I understand what this page is for immediately?
2. Can I find an existing record?
3. Can I create what I reasonably expect to create?
4. Can I edit it?
5. Are errors visible and understandable?
6. Can I get back to the rest of Admin easily?
7. Are tables/cards usable without pathological nested scrollbars?
8. Does the state shown agree with MCP?

Record UX problems separately from functional failures.

Use:

    FUNCTIONAL BUG
    UX BUG
    ENHANCEMENT

Do not mix those categories.

============================================================
PHASE 25 — FINAL REPORT
============================================================

At the end the agent must produce:

CAMPAIGNOS ACCEPTANCE TEST REPORT

Test session:
<TEST_PREFIX>

Environment:
<origin, without secrets>

MCP client:
<client name>

--------------------------------------------------

CORE

Authentication ............ PASS / FAIL
Admin session .............. PASS / FAIL
Database ................... PASS / FAIL
Dashboard .................. PASS / FAIL

DOMAINS

Work Items ................. PASS / FAIL
Canon ...................... PASS / FAIL
Decisions .................. PASS / FAIL
Assets ..................... PASS / FAIL
Asset revisions ............ PASS / FAIL
External assets ............ PASS / FAIL
Upload Requests ............ PASS / FAIL
Websites ................... PASS / FAIL
Content .................... PASS / FAIL
Contacts ................... PASS / FAIL

KNOWLEDGE SYSTEM

Memory CRUD ................ PASS / FAIL
Smart Recall ............... PASS / FAIL
Context Bootstrap .......... PASS / FAIL
Duplicate prevention ....... PASS / FAIL
Supersession ............... PASS / FAIL
Tags ....................... PASS / FAIL
Relationships .............. PASS / FAIL
Global Search .............. PASS / FAIL

INTEGRITY

Optimistic concurrency ..... PASS / FAIL
Activity/audit ............. PASS / FAIL
MCP/Admin parity ........... PASS / FAIL
Public upload isolation .... PASS / FAIL
Cross-client memory ........ PASS / FAIL

--------------------------------------------------

FAILURES

For every failure:

TEST:
EXPECTED:
ACTUAL:
UI RESULT:
MCP RESULT:
DATA MODIFIED:
SEVERITY:
LIKELY AREA:
REPRODUCTION STEPS:

--------------------------------------------------

UX ISSUES

List separately.

--------------------------------------------------

UNTESTED

Explicitly list anything we did NOT actually test.

Never convert "not tested" into PASS.

============================================================
PHASE 26 — CLEANUP
============================================================

Do NOT hard-delete historical data merely for tidiness if CampaignOS intentionally
uses archival/history semantics.

Search:

    <TEST_PREFIX>

Identify every disposable test record.

Where supported and appropriate:

- archive memories
- supersede/archive disposable records
- revoke unused upload links
- mark disposable Work Items appropriately
- remove disposable tag/relation associations when safe

Do NOT delete Activity history.

Do NOT accidentally modify real campaign data.

Produce a final cleanup list.

============================================================
INTERACTIVE AGENT BEHAVIOUR
============================================================

The agent conducting this runbook must behave like a test engineer.

Do NOT say:

    "Please execute phases 1–26 and tell me what happens."

Instead say something like:

    "Test 1.1 — Admin authentication.

     Open /admin in a private browser window.
     Tell me whether you are redirected to /login.
     Do not enter the password yet."

WAIT.

After the human replies, record the observation and proceed to the next action.

When the human changes something in Admin, independently verify it through MCP.

When the agent changes something through MCP, ask the human to verify it in
Admin.

Never mark PASS solely because the interface that performed the mutation said
"success".

Cross-interface verification is the point of this test.

============================================================
GOLDEN RULE
============================================================

A feature passes only when:

    HUMAN UI ACTION
           ↓
    DATABASE
           ↓
    MCP CAN VERIFY IT

or:

    MCP ACTION
       ↓
    DATABASE
       ↓
    HUMAN UI CAN VERIFY IT

CampaignOS is successful only if both interfaces represent the same durable
operational reality.