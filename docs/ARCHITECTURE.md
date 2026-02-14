# Architecture — ordinals-mcp

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Best MCP SDK support, all APIs have REST/TS clients |
| MCP SDK | `@modelcontextprotocol/sdk` v1.8+ | Official SDK |
| Transport | StdioServerTransport (primary) | Claude Desktop / Claude Code compatible |
| Validation | `zod` + `zod-to-json-schema` | Standard MCP pattern |
| HTTP | Native `fetch` (Node 18+) | No heavy deps |
| Build | TypeScript + esbuild (single bundle) | Fast builds, `npx`-friendly |
| Package | npm | Widest compatibility |

## Directory Structure

```
ordinals-mcp/
  package.json
  tsconfig.json
  README.md
  CLAUDE.md
  src/
    index.ts                    # Server entry, tool registration
    config.ts                   # API keys, rate limit configs, env vars
    types.ts                    # Shared types (McpAction pattern)
    clients/
      hiro.ts                   # Hiro API client (ordinals + runes)
      ordiscan.ts               # Ordiscan client (via SDK)
      magic-eden.ts             # Magic Eden client
      bestinslot.ts             # BestInSlot client
      ordinalsbot.ts            # OrdinalsBot client (write ops)
    cache/
      index.ts                  # TTL cache with ETag support
    rate-limit/
      index.ts                  # Per-API token bucket
    tools/
      inscriptions/
        get.ts                  # get_inscription
        search.ts               # search_inscriptions
        content.ts              # get_inscription_content
        transfers.ts            # get_inscription_transfers
        traits.ts               # get_inscription_traits
      address/
        inscriptions.ts         # get_address_inscriptions
        brc20.ts                # get_brc20_balances
        runes.ts                # get_rune_balances
        rare-sats.ts            # get_address_rare_sats
        utxos.ts                # get_address_utxos
      runes/
        info.ts                 # get_rune_info
        list.ts                 # list_runes
        holders.ts              # get_rune_holders
        activity.ts             # get_rune_activity
        market.ts               # get_rune_market_info
      brc20/
        token.ts                # get_brc20_token
        activity.ts             # get_brc20_activity
      collections/
        info.ts                 # get_collection_info
        inscriptions.ts         # get_collection_inscriptions
        listings.ts             # get_collection_listings
      sats/
        info.ts                 # get_sat_info
      tx/
        inscriptions.ts         # get_tx_inscriptions
        runes.ts                # get_tx_runes
      write/                    # Only registered if ORDINALSBOT_API_KEY set
        inscribe.ts             # create_inscription_order
        etch-rune.ts            # etch_rune
```

## API Priority & Fallback Chain

```
Request → Cache check (TTL + ETag)
  ├── Cache HIT → return cached
  └── Cache MISS →
      ├── Hiro (primary, 500 RPM)
      │   ├── Success → cache + return
      │   └── Rate limited / error →
      │       ├── Ordiscan (secondary)
      │       │   ├── Success → cache + return
      │       │   └── Rate limited →
      │       │       └── Return stale cache with warning
      │       └── (or Magic Eden / BestInSlot for specific data)
      └── API-specific tools (no fallback):
          ├── Magic Eden → marketplace data only
          ├── BestInSlot → UTXO/mempool data only
          └── OrdinalsBot → write operations only
```

## Rate Limiting Strategy

```
Per-API token buckets:
  Hiro:        500 req/min (with key), 50 req/min (without)
  Ordiscan:    Daily limits (free tier)
  Magic Eden:  30 req/min
  OrdinalsBot: 12 req/min (/inscribe endpoint)
  BestInSlot:  Daily limits (free/trial)

Safety margin: Use 80% of stated limits
```

## Caching Strategy

```
TTL by data volatility:
  Sat rarity:           24h  (never changes)
  Inscription metadata: 5min (rarely changes after confirm)
  Rune etching info:    5min (static after creation)
  Collection info:      2min (prices change)
  BRC-20 balances:      1min (active trading)
  Rune balances:        1min (active trading)
  Marketplace listings: 30s  (volatile)
  Rune/BRC-20 activity: 30s  (real-time data)

ETag support for Hiro API:
  - Store ETag from response headers
  - Send If-None-Match on repeat requests
  - 304 Not Modified → serve from cache, no rate limit hit
```

## Environment Variables

```env
# Required (at least one)
HIRO_API_KEY=           # From platform.hiro.so (500 RPM)
ORDISCAN_API_KEY=       # From ordiscan.com/docs/api (free)

# Optional (enable additional features)
MAGIC_EDEN_API_KEY=     # Higher marketplace rate limits
BESTINSLOT_API_KEY=     # Collection/UTXO data
ORDINALSBOT_API_KEY=    # Write operations (inscribe, etch)

# Server config
CACHE_TTL_SECONDS=300   # Default cache TTL
RATE_LIMIT_BUFFER=0.8   # 80% safety margin
```

## Installation (target)

```json
{
  "mcpServers": {
    "ordinals": {
      "command": "npx",
      "args": ["ordinals-mcp@latest"],
      "env": {
        "HIRO_API_KEY": "...",
        "ORDISCAN_API_KEY": "..."
      }
    }
  }
}
```

## Differentiation from Existing ordiscan-mcp

| Feature | ordiscan-mcp | ordinals-mcp (ours) |
|---------|-------------|---------------------|
| APIs | Ordiscan only | Hiro + Ordiscan + Magic Eden + BestInSlot + OrdinalsBot |
| Tools | 17 | 28 |
| Marketplace data | None | Listings, floor prices, sales |
| Rune holders/activity | None | Via Hiro |
| BRC-20 activity | None | Deploy/mint/transfer events |
| Inscription content | None | Raw content delivery |
| Caching | None | TTL + ETag |
| Rate limiting | None | Per-API token buckets |
| Write operations | None | Inscribe + etch via OrdinalsBot |
| UTXO/Mempool | None | Via BestInSlot |
| Alkanes | None | Via Ordiscan |
| Fallback chain | None | Multi-API with graceful degradation |
