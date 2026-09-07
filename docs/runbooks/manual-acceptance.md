# Manual Acceptance and Verification Runbook

This runbook specifies the manual verification procedure for **Rejectionism CampaignOS**, covering authentication boundaries, all seven Admin registers, the asset library with revisions and representations, upload-link capability lifecycles, public contributor submissions, generic tags, directed relationships, global search, MCP client interactions, and abandoned-file cleanup.

Follow these procedures after automated test suites (`pnpm test` and `pnpm test:integration`) pass.

---

## 1. Prerequisites and Local Environment

1. **Environment Configuration (`.env.local`)**:
   ```bash
   # Operational PostgreSQL database
   MCP_PRISMA_DATABASE_URL="postgresql://user:pass@host:5432/dbname"

   # Disposable test PostgreSQL database (must differ from operational)
   TEST_MCP_PRISMA_DATABASE_URL="postgresql://user:pass@host:5432/test_dbname"

   # High-entropy credential (32–256 chars, [A-Za-z0-9_-])
   CAMPAIGNOS_PASSWORD="example-shared-secret-must-be-32-chars-long-minimum"

   # Base URL origin (development default)
   CAMPAIGNOS_BASE_URL="http://localhost:3000"

   # Vercel Blob read-write token (optional for local mock tests; required for live blob acceptance)
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
   ```

2. **Initialize Database and Start Dev Server**:
   ```bash
   pnpm db:deploy
   pnpm db:backfill-assets
   pnpm db:seed
   pnpm dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 2. Admin UI Acceptance Scenarios

### Scenario 1: Authentication Boundaries & Session Management
1. **Public Landing (`GET /`)**:
   - Navigate to `http://localhost:3000/`.
   - Verify: Static introduction renders with "Enter HQ" button. No campaign data, counters, or test-mode banners are visible.
2. **Unauthenticated Admin Redirect**:
   - Navigate to `http://localhost:3000/admin`.
   - Verify: Browser redirects immediately to `/login`.
3. **Login Form Validation**:
   - Enter an incorrect password (e.g. `wrong-password`). Submit.
   - Verify: Generic error message displayed ("Invalid credentials"). Password field is cleared and not echoed in URL or DOM.
   - Submit the valid configured `CAMPAIGNOS_PASSWORD`.
   - Verify: Redirects to `/admin` dashboard; `campaignos_session` HttpOnly cookie is set with 7-day expiry.
4. **Logout Flow**:
   - Click "Logout" in the Admin navigation.
   - Verify: Session cookie is expired and browser redirects to `/login`. Navigating back to `/admin` redirects to `/login`.

---

### Scenario 2: Dashboard & Register Navigation
1. Log in to `/admin`.
2. **Dashboard Metrics**:
   - Verify status summary cards render with real counts: Work Items by status, Assets (including Missing/Draft/Approved counters), Websites, Content Items, Contacts, and Recent Decisions.
   - Verify Activity Feed displays recent audit events with timestamps, entity types, and action summaries.
3. **Register Navigation**:
   - Click each navigation link: **Work Items**, **Canon**, **Decisions**, **Assets**, **Websites**, **Content**, **Contacts**, **Upload Links**.
   - Verify each register renders a table/list view with working filter controls, correct pagination, and links to detail pages.

---

### Scenario 3: Human Asset Creation, Revisions, and Representations
1. **Create Metadata-Only Asset**:
   - Navigate to `/admin/assets` and click **New Asset**.
   - Enter Name: `Primary Rejectionism Seal`, Kind: `seal`, Status: `DRAFT`, Notes: `Official seal master`. Leave URL empty.
   - Submit form.
   - Verify: Asset is created with `version: 1`, `revision: 1`, and zero representations. Status badge is `DRAFT`.
2. **Add External URL Representation**:
   - On the Asset detail page, navigate to **Add Representation**.
   - Select **External URL**. Enter URL: `https://drive.google.com/file/d/example/view`, Label: `Google Drive Archive`, Variant: `Archive`.
   - Submit form.
   - Verify: Representation is added to Revision 1. Because Revision 1 was empty, this first representation automatically becomes **Primary** (`isPrimary: true`). Asset version increments to 2.
3. **Create New Revision**:
   - Click **New Revision**. Label: `2026 Polish`, Notes: `Refined vector paths`.
   - Submit form.
   - Verify: Revision 2 is created. Because Revision 2 is empty, it has no primary representation yet. Asset version increments to 3.
4. **Switch Primary Representation**:
   - Add two representations to Revision 2 (e.g., two external URLs).
   - The first becomes primary. Click **Make Primary** on the second representation.
   - Verify: Second representation becomes primary; first loses primary status; parent Asset version increments by 1. Clicking Make Primary on the already-primary representation is a no-op (version unchanged).
5. **Approved Status Enforcement**:
   - Change Asset status to `APPROVED`.
   - Verify: Allowed only because Revision 2 has at least one representation.
   - Create a new Revision 3 (empty).
   - Verify: Asset status automatically reverts to `DRAFT` (or `NEEDS_WORK`) per section 7 rules.

---

### Scenario 4: Generic Tags and Directed Relationships
1. **Tagging Entities**:
   - Open any Work Item, Canon Entry, Asset, Website, Content Item, or Contact.
   - In the **Tags** section, enter `Campaign 2026` and click **Add Tag**.
   - Verify: Tag is attached as normalized slug `campaign-2026`.
   - Attach another tag `Visual Identity` -> slug `visual-identity`.
   - Detach `campaign-2026`.
   - Verify: Tag membership is removed; tag definition remains in system. Parent entity version is NOT incremented (set operation concurrency).
2. **Filtering by Tags**:
   - Navigate to `/admin/assets`. Filter by tag `visual-identity`.
   - Verify: Only assets carrying all specified tags are listed.
3. **Directed Relationships**:
   - Open a Content Item (e.g. `Coronation Speech`).
   - In the **Relationships** section, click **Link Entity**.
   - Select Direction: `Outgoing`, Target Type: `ASSET`, Target: `Primary Rejectionism Seal`, Relation Type: `USES_ASSET`, Notes: `Hero artwork in header`.
   - Submit.
   - Verify: Relation is created. Open the `Primary Rejectionism Seal` Asset page -> verify incoming relation from `Coronation Speech` is visible with correct type and notes.
   - Remove relation -> verify edge is removed from both endpoints without deleting the entities.

---

### Scenario 5: Upload Links & Contributor Submission Flow
1. **Create Upload Link**:
   - Navigate to `/admin/upload-links` -> **Create Upload Link**.
   - Title: `Kommissar Banner Submissions`, Max Items: `5`, Expiry: `7 days`, Target: `Primary Rejectionism Seal` (Revision 2).
   - Submit.
   - Verify: A raw capability URL `http://localhost:3000/upload/<43-char-token>` is displayed with a **Copy** button.
   - Refresh the page: Verify the raw token is **never shown again** (stored only as SHA-256 hash).
2. **Public Contributor Submission (`/upload/[token]`)**:
   - Open a **private/incognito window** (no admin session).
   - Navigate to the copied upload URL `http://localhost:3000/upload/<token>`.
   - Verify: Public submission form renders title and instructions. No admin navigation, database IDs, or internal asset metadata are exposed.
   - Add an External URL item: `https://example.com/banner-render.png`, Name: `Banner Render`, Kind: `banner`.
   - Click **Submit Artwork**.
   - Verify: Submission completes, displaying a confirmation with `submissionKey` and item count.
3. **Replay & Consumed Link Safety**:
   - Refresh the public upload page or click Back.
   - Verify: The page displays "Already Submitted" with the receipt. Re-submitting the same payload returns the existing receipt without creating new entities.
4. **Admin Verification of Submission**:
   - In your authenticated Admin window, open `Primary Rejectionism Seal`.
   - Verify: Revision 2 now includes the submitted representation (`Banner Render`), and Activity logs `UPLOAD_SUBMITTED`.

---

### Scenario 6: Admin Bulk Upload with Direct Blob Storage
1. Log in to `/admin`.
2. Navigate to `/admin/assets/upload` (or click **Bulk Upload** on `/admin/assets`).
3. Select grouping mode:
   - **Separate New Assets**: each uploaded file becomes a distinct asset.
   - **New Revision of One Asset**: combines all uploaded files into a newly created revision of an existing asset.
   - **Representations of One Revision**: appends files as representations to an existing revision.
4. Click **Start Upload Session**.
5. Drag and drop test files (or add external URLs).
6. Verify:
   - Progress bar tracks client-to-storage transfer via `@vercel/blob/client`.
   - Server-side inspection validates MIME types, byte sizes, and dimensions in real time.
   - Finalization atomically registers the assets and presents links to the created records.

---

### Scenario 7: Global Search
1. In the Admin header, locate the global search bar.
2. Enter search query `Rejectionism`.
3. Verify: Results return matching items across all registers (Work Items, Canon, Decisions, Assets, Websites, Content, Contacts) with direct navigation links and highlighted snippets.
4. Filter search by entity type (e.g., only `DECISION`) and by tag.
5. Verify: Contacts in global search results **never** disclose private email addresses or notes.

---

## 3. MCP Server Acceptance Scenarios

### Option A: Testing with `scripts/test-client.mjs`
```bash
# 1. Unauthenticated rejection (must return HTTP 401)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/mcp
# Expected: 401

# 2. Run read-only protocol smoke test against canonical /api/mcp
CAMPAIGNOS_PASSWORD="<your-configured-password>" pnpm test:client -- http://localhost:3000

# 3. Run read-only protocol smoke test against legacy /mcp
CAMPAIGNOS_PASSWORD="<your-configured-password>" pnpm test:client -- http://localhost:3000 --path=/mcp

# 4. Opt-in write test against disposable target only
CAMPAIGNOS_PASSWORD="<your-configured-password>" pnpm test:client -- http://localhost:3000 --test-writes --disposable-database
```

---

### Option B: Interactive Testing with MCP Inspector

1. **Launch Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
   ```
2. **Provide Authorization**:
   - In the MCP Inspector UI, add header: `Authorization: Bearer <CAMPAIGNOS_PASSWORD>`.
3. **Verify Tool Inventory**:
   - Click **List Tools**.
   - Verify all 47 tools are registered matching the contract.
4. **Execute Sample Tool Calls**:
   - `campaign_list_work_items` with `{}` -> returns structured list of items and total count.
   - `campaign_search` with `{"query": "Rejectionism"}` -> returns structured search results.
   - `campaign_get_asset` with `{"id": "<asset-id>"}` -> returns asset detail with revisions and representations.
   - `campaign_tag_entity` with `{"entityType": "ASSET", "entityId": "<asset-id>", "tag": "mcp-verified"}` -> returns attached tag.
   - `campaign_list_tags` with `{"search": "mcp"}` -> returns `mcp-verified`.

---

## 4. Abandoned File Cleanup CLI

1. **Dry-Run Mode (Default)**:
   ```bash
   pnpm files:cleanup-uploads
   ```
   Verify: Outputs candidate unreferenced upload files without deleting anything (`dryRun=true`, `deleted=0`).
2. **Apply Deletion Mode**:
   ```bash
   pnpm files:cleanup-uploads --apply
   ```
   Verify: Eligible unreferenced files older than 24 hours are set to `DISCARDED` and removed from private storage (`dryRun=false`).

---

## 5. End-to-End Human Acceptance Walkthrough

Execute the following sequential scenario using disposable test fixtures:

1. **Login**: Navigate to `/login`, enter `CAMPAIGNOS_PASSWORD`, and submit. Verify redirection to `/admin`.
2. **Create Work Item**: Click `+ Work Item` on the dashboard. Submit an empty form to verify inline field error feedback without loss of entered text. Fill title `Acceptance Test Work Item`, priority `50`, status `BACKLOG`. Verify created record appears with "View record".
3. **Select & Link Asset**: On the work item page, click `+ Link Entity`. Select relation `USES_ASSET` (which restricts target type to `ASSET`). Use `EntityPicker` to search and select an asset (e.g. `logo` or `poster`). Save relationship and verify directed link `USES_ASSET` is visible.
4. **Internal Bulk Upload**: Navigate to `/admin/assets/upload`. Select `Separate New Assets`. Click `Start Upload Session`. Drag and drop or browse test image files. Verify per-row upload progress and automatic byte verification. Finalize and verify resulting asset links.
5. **Inspect Revision & Primary**: Open the created asset detail page. Verify Revision 1 exists with one primary representation. Add a secondary external URL representation -> verify primary remains on the first item unless switched.
6. **Workflow Status & Concurrency**: Change asset status to `APPROVED`. Verify allowed because a valid representation exists.
7. **Complete Work Item**: Return to `Acceptance Test Work Item`. Move status to `DONE` and provide a completion note or evidence URL. Submit and verify status updates to `DONE`.
8. **Search & Discovery**: In the global search bar, query `Acceptance Test`. Verify the work item appears in results with snippets and tags.
9. **MCP Protocol Read**: Query `campaign_search` or `campaign_get_work_item` using `test:client` to verify external protocol parity.
10. **Logout**: Click `Log Out` in navigation and verify session destruction.

---

## 6. Summary Checklist for Release Verification

- [ ] `pnpm db:validate` — Prisma schema is valid.
- [ ] `pnpm type-check` — Strict TypeScript compilation passes with 0 errors.
- [ ] `pnpm test` — All unit tests pass.
- [ ] `pnpm test:integration` — Integration tests pass against disposable PostgreSQL (`TEST_MCP_PRISMA_DATABASE_URL`).
- [ ] `pnpm test:client -- http://localhost:3000` — MCP smoke client reads succeed on `/api/mcp` and `/mcp` across all 47 tools.
- [ ] Browser Acceptance Scenarios 1–7 and End-to-End Walkthrough complete without errors.
- [ ] `git --no-pager diff --check` — No merge markers, trailing whitespace, or uncommitted secrets.
