# MCP Tool Design — ordinals-mcp

> Tiered tool inventory for the Bitcoin Ordinals MCP server

## Tier 1 — Core (Must-Have, MVP)

| Tool Name | Description | Primary API | Fallback |
|-----------|-------------|-------------|----------|
| `get_inscription` | Inscription metadata by ID or number | Hiro | Ordiscan |
| `get_inscription_content` | Raw content (image, text, etc.) | Hiro | — |
| `search_inscriptions` | List/filter inscriptions (address, mime, rarity, block range) | Hiro | Ordiscan |
| `get_address_inscriptions` | All inscriptions owned by an address | Hiro | Ordiscan |
| `get_inscription_transfers` | Transfer history for an inscription | Hiro | — |
| `get_sat_info` | Sat details (rarity, inscriptions) | Hiro | Ordiscan |
| `get_brc20_token` | BRC-20 token details (supply, holders) | Hiro | Ordiscan |
| `get_brc20_balances` | BRC-20 balances for an address | Hiro | Ordiscan |
| `get_rune_info` | Rune etching details | Hiro | Ordiscan |
| `get_rune_balances` | Rune balances for an address | Hiro | Ordiscan |
| `get_address_rare_sats` | Rare sats held by an address | Ordiscan | — |

**11 tools — covers all core read operations**

---

## Tier 2 — Collections & Market Data

| Tool Name | Description | Primary API | Fallback |
|-----------|-------------|-------------|----------|
| `get_collection_info` | Collection details, stats, floor price | Ordiscan | BestInSlot |
| `get_collection_inscriptions` | List inscriptions in a collection | Ordiscan | BestInSlot |
| `search_collections` | Search/list collections | BestInSlot | Ordiscan |
| `get_rune_market_info` | Rune price and market cap | Ordiscan | — |
| `get_collection_listings` | Active marketplace listings for collection | Magic Eden | — |
| `get_inscription_traits` | Trait info for collection inscription | Ordiscan | — |

**6 tools — marketplace and collection intelligence**

---

## Tier 3 — Runes & Advanced Analytics

| Tool Name | Description | Primary API | Fallback |
|-----------|-------------|-------------|----------|
| `list_runes` | List all runes with filters | Hiro | Ordiscan |
| `get_rune_holders` | Top holders of a specific rune | Hiro | — |
| `get_rune_activity` | Mint/transfer activity for a rune | Hiro | — |
| `get_brc20_activity` | Deploy/mint/transfer events | Hiro | — |
| `get_tx_inscriptions` | Inscriptions in a transaction | Ordiscan | — |
| `get_tx_runes` | Rune transfers in a transaction | Ordiscan | — |
| `get_rune_unlock_date` | When a rune name becomes available | Ordiscan | — |
| `get_address_utxos` | UTXOs for address (cardinal/ordinal/runic) | BestInSlot | — |

**8 tools — deep analytics and protocol data**

---

## Tier 4 — Write Operations (Optional, gated)

| Tool Name | Description | Primary API | Gate |
|-----------|-------------|-------------|------|
| `create_inscription_order` | Create an inscription order | OrdinalsBot | ORDINALSBOT_API_KEY |
| `etch_rune` | Etch a new rune | OrdinalsBot | ORDINALSBOT_API_KEY |
| `check_order_status` | Check inscription order status | OrdinalsBot | ORDINALSBOT_API_KEY |

**3 tools — only registered if ORDINALSBOT_API_KEY is set**

---

## Total: 28 tools across 4 tiers

### Input Schema Patterns

All tools use Zod schemas. Common patterns:

```typescript
// Inscription lookup
{ id: z.string().describe("Inscription ID ({txid}i{index}) or number") }

// Address lookup
{ address: z.string().describe("Bitcoin address (bc1p..., bc1q..., 1..., 3...)") }

// Paginated list
{
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(20).max(60),
}

// Inscription search filters
{
  address: z.string().optional(),
  mime_type: z.string().optional(),
  rarity: z.enum(["common","uncommon","rare","epic","legendary","mythic"]).optional(),
  from_block: z.number().optional(),
  to_block: z.number().optional(),
  from_number: z.number().optional(),
  to_number: z.number().optional(),
  cursed: z.boolean().optional(),
  recursive: z.boolean().optional(),
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(20),
}
```

### Response Format

All tools return `CallToolResult` with:
- `content[0].type = "text"` — JSON-formatted data
- Error responses include error type and message
- Paginated responses include `total`, `offset`, `limit` fields
