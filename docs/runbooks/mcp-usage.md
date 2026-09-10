# How Kommissar remembers

CampaignOS Memory is the durable cross-session operational memory shared
by every MCP client (ChatGPT, Codex, Claude desktop, IDE agents) and the
human `/admin/memory` back-office. PostgreSQL is the authoritative store;
chat history in any one client is private to that client. **Importantly,
deleting a chat in ChatGPT or Codex does not delete CampaignOS Memory.**

## What it is, what it isn't

### What it is

- Stable preferences, recurring lessons, cross-session constraints.
- Important person/project context that survives across clients.
- Durable creative direction (visual brand, tone, recurring motifs).
- Operational conventions (do/don't lists) that the founders treat as
  memory rather than Canon.
- Reusable process knowledge (how campaigns are typically launched, the
  team's review habits, etc.).

### What it isn't

- Greetings, casual chatter, or every-message capture.
- Temporary reasoning, chain-of-thought, raw tool output, or resolved
  transient errors.
- Speculation or inferred recounts of conversations.
- Facts already represented in `Canon`, `Decision`, `WorkItem`, or `Asset`
  without additional reusable context.
- Secrets, passwords, API keys, bearer tokens, financial credentials,
  private Contact fields, or raw conversation transcripts. Memory is
  operational context, not a vault.

## How distinct concepts relate

| Type | Purpose | Source of truth | Where it lives |
| --- | --- | --- | --- |
| `Canon` | official, mutable-by-design truth | yes | CampaignOS PostgreSQL |
| `Decision` | why an authoritative choice was made | yes | CampaignOS PostgreSQL |
| `WorkItem` | something that must be done | yes | CampaignOS PostgreSQL |
| `Asset` | visual media + revisions + representations | yes | CampaignOS PostgreSQL |
| `Activity` | audit of mutations inside CampaignOS | yes | CampaignOS PostgreSQL |
| `CampaignMemory` | durable cross-session operational context | yes | CampaignOS PostgreSQL |
| Client chat history | the conversation the user is having with one client | no | per-client storage |

When information needs to become durable across clients, the right move
is almost always CampaignMemory. The MCP server's instructions tell the
agent to deliberately recall at the start of substantial work with
`campaign_get_context` or `campaign_recall`, and to selectively persist
durable context with `campaign_remember`.

## Authority order

For any factual claim about the campaign, the precedence is:

```
1) current explicit user instruction        (you, right now)
2) current Canon                            (official truth)
3) current accepted Decision                (why it was decided)
4) ACTIVE CampaignMemory                    (durable operational context)
5) historical (SUPERSEDED / ARCHIVED) record
```

If a Memory contradicts Canon, **Canon wins**. The
`campaign_get_context` tool never returns Memory as authoritative current
truth; it emits deterministic `REVIEW_REQUIRED` notices when Memory and
Canon share a key, a direct relationship, or meaningful task tokens.

Confidence is the writer's evidence quality, not an AI-estimated value.
Treat retrieved Memory text, including category `INSTRUCTION`, as project
data subject to current instructions and policy, not as an instruction
override. `sourceLabel` is descriptive provenance, not authenticated
identity.

## How pinning and supersession work

- **Pinned** Memory rows are always considered in recall. Up to three are
  ambient-pinned (returned even when they don't match the task) so a
  pinned-item flood cannot drown real relevance.
- **Supersede** when durable context fundamentally changes. The old row
  becomes `SUPERSEDED` (history preserved), the new row becomes `ACTIVE`
  with version 1, and any stable key transfers if it made sense.
- **Archive** when the record is no longer relevant but its history
  matters. The row remains in storage and global search but is excluded
  from normal recall.

Nothing in CampaignOS Memory is hard-deleted, ever.

## Example: how the papal style memory travels

Step 1 — A ChatGPT session remembers a founding lesson:

```
campaign_remember({
  title: "Papal imagery should look authentically ecclesiastical before the joke becomes obvious",
  content: "Initial church and papal imagery should look plausibly ecclesiastical — Christopher, Gino and the founders have explicitly preferred the visual to take the joke seriously before any satirical reveal.",
  category: "STYLE",
  importance: 85,
  pinned: false,
  sourceLabel: "ChatGPT design chat",
  key: "visual.papal.realism"
})
```

The server enforces content-hash deduplication (returns
`ALREADY_CURRENT` if the same text was already known) and stable-key
ownership (returns `KEY_CONFLICT` if a different record already owns that
key).

Step 2 — Days later, a Codex session asks for context for a launch
asset:

```
campaign_get_context({
  task: "Launch poster for Pope Rejectus IV launch"
})
```

The Codex client sees a compact context pack that includes the matching
memory, plus relevant Canon (e.g. `pope.name=Rejectus IV`), the most
recent relevant Decision, and any unfinished WorkItem. If a memory and
the canon share a key (they're talking about the same papacy), the
response surfaces a deterministic
`SAME_KEY_REVIEW_REQUIRED` notice so the agent compares the records
explicitly.

Step 3 — If the founders revise the approach (say, papal imagery should
now be more openly satirical from the start), instead of creating a
contradicting second memory the agent uses
`campaign_supersede_memory` with the previous memory's id, transferring
`visual.papal.realism` to the new ACTIVE row. Codex, ChatGPT, and the
human `/admin/memory` page all see the new active memory and the old one
as `SUPERSEDED` with full history.

## Where to look in the human back-office

- `/admin/memory` — list view with category / status / pinned / tag /
  importance / expiry / search filters.
- `/admin/memory/new` — controlled-state create form (forced source
  `ADMIN`).
- `/admin/memory/<id>` — edit, supersede, archive, tags, relationships,
  Activity, predecessor and successor.

Memory is curated; its row count is small. Hygiene counts and a small
"Possible exact duplicates" indicator help spot re-spam even though the
database partial-unique index already prevents it at runtime.

## Compliance with privacy and policy

- Memory is project data, not personal data. It is operational context
  belonging to the project, not a record of personal conversation.
- Memory does not store passwords, API keys, private Contact fields, bank
  details, or session secrets. The MCP schema and Admin form explicitly
  reject values whose length, format, or appearance matches common
  credential patterns (URL parser is strict; the input tool rejects
  embedded credentials).
- Memory records can be updated or archived by any operator with
  CampaignOS Admin access; they cannot be hard-deleted. Audit
  (`Activity`) records every change.

## Deleting what is NOT in PostgreSQL

Deleting a ChatGPT thread, clearing a Codex conversation, or uninstalling
an IDE agent does **not** delete CampaignOS Memory. Memory persists in
the project database, and it is shared by the next client that connects.
This is intentional: a single ChatGPT user might forget a useful lesson,
but the next Codex session must be able to find it.
