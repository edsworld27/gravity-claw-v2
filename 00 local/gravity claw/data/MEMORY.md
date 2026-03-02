# Memory System

Gravity Claw uses a three-tier memory system that gives the bot persistent, searchable, and structured recall across every conversation. Each tier serves a distinct purpose and degrades gracefully if unavailable.

---

## Tier 1 — SQLite Conversation Memory

**Local · Instant · Always Available**

The foundation layer. A local SQLite database (`memory.db`) that stores facts, conversation history, and rolling summaries. This is the bot's short-term and working memory.

| Table | What it stores | How it's used |
|-------|----------------|---------------|
| `explicit_memories` | Durable facts about the user (name, preferences, timezone, goals) | Injected into every system prompt so the bot always "knows" you |
| `messages` | Full conversation history (role, content, timestamp) | Last 20 messages loaded as context for each response |
| `knowledge_graph` | Subject-predicate-object triplets | Structured relationships between entities |
| `vector_memories` | Local embeddings with SQLite fallback | Offline semantic search capability |

### Automatic Fact Extraction
After every exchange, facts can be extracted and saved to `explicit_memories` automatically, so you never have to tell the bot twice.

### Compaction
When the message count for a chat exceeds 30, older messages are summarized by the LLM and pruned. This keeps the context window lean without losing information.

---

## Tier 2 — Supabase/pgvector Semantic Memory

**Cloud · Meaning-Based Search · Long-Term Recall**

The associative memory layer. Every conversation exchange is embedded into vectors and stored in Supabase pgvector, making the bot's entire history searchable by *meaning* rather than keywords.

| Aspect | Detail |
|--------|--------|
| Embedding model | `text-embedding-3-small` (OpenAI) |
| Relevance threshold | Results below 0.5 similarity score are filtered out |
| Pattern | Fire-and-forget — embedding happens in background, never blocks the user |
| Top K results | 5 most relevant matches returned per query |
| Fallback | SQLite local search if Supabase unavailable |

### Namespaces
- **conversations**: Every user/assistant exchange is embedded
- **knowledge**: Ingested content (transcripts, URLs, documents)

---

## Tier 3 — Supabase Data Store

**Cloud · Structured Data · Analytics & Dashboard**

The structured persistence layer. A Supabase PostgreSQL database that stores arbitrary data, activity logs, and LLM cost tracking. This tier powers Mission Control.

| Table | Purpose |
|-------|---------|
| `configs` | Key-value configuration storage |
| `activity_log` | Every bot action logged for the dashboard |
| `stats` | Aggregate statistics (tokens, messages, costs) |

---

## How They Work Together

```
User sends message
       ↓
Load Memory (parallel)
  ├── Tier 1: Explicit facts
  ├── Tier 1: Last 20 messages
  ├── Tier 1: Knowledge graph
  └── Tier 2: Semantic search (top 5)
       ↓
Build context & call LLM
       ↓
Generate response
       ↓
Background tasks (fire-and-forget)
  ├── Tier 1: Save messages
  ├── Tier 2: Embed exchange
  ├── Tier 3: Log activity
  └── Tier 1: Compact if > 30 msgs
```

---

## Agent-Accessible Memory Tools

| Tool | Tier | What it does |
|------|------|--------------|
| `save_memory` | Tier 1 | Explicitly store a fact to explicit_memories |
| `search_history` | Tier 1 | FTS5 keyword search over messages |
| `semantic_search` | Tier 2 | Vector similarity search |
| `kg_save` | Tier 1 | Save subject-predicate-object triplet |
| `kg_query` | Tier 1 | Query knowledge graph |

---

## Key Design Principles

**Graceful degradation** — Each tier initializes independently. If Supabase is down, SQLite still works. No single failure takes everything down.

**Non-blocking writes** — All post-response memory operations run as fire-and-forget background tasks. The user never waits for memory to save.

**Automatic compaction** — Conversation history self-manages. Once messages exceed 30, older ones are summarized and pruned.

**Redundancy by design** — Tier 1 and Tier 2 intentionally overlap. SQLite provides fast exact recall; Supabase provides meaning-based search over the same conversations.
