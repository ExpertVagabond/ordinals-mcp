# ordinals-mcp

[![npm version](https://img.shields.io/npm/v/ordinals-mcp)](https://www.npmjs.com/package/ordinals-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js)](https://nodejs.org)
[![Tools](https://img.shields.io/badge/tools-24-blue)](https://modelcontextprotocol.io)

**The most complete Bitcoin Ordinals MCP server.** 24 tools covering inscriptions, runes, BRC-20 tokens, collections, rare sats, and marketplace data. Aggregates Hiro, Ordiscan, and Magic Eden APIs with intelligent caching and automatic failover.

The only alternative (ordiscan-mcp) has 25 npm downloads and covers a fraction of the surface. This server is the production-grade option.

## Install

```bash
npx ordinals-mcp@latest
```

Or install globally:

```bash
npm install -g ordinals-mcp
ordinals-mcp
```

## Configure

Add to your MCP config (`claude_desktop_config.json` or `~/.mcp.json`):

```json
{
  "mcpServers": {
    "ordinals": {
      "command": "npx",
      "args": ["-y", "ordinals-mcp@latest"],
      "env": {
        "HIRO_API_KEY": "your-key",
        "ORDISCAN_API_KEY": "your-key"
      }
    }
  }
}
```

At least one of `HIRO_API_KEY` or `ORDISCAN_API_KEY` is required. Both are free:

| Provider | Rate Limit | Get Key |
|----------|-----------|---------|
| **Hiro** (primary) | 500 RPM | [platform.hiro.so](https://platform.hiro.so) |
| **Ordiscan** (fallback) | -- | [ordiscan.com/docs/api](https://ordiscan.com/docs/api) |
| **Magic Eden** (optional) | -- | [docs.magiceden.io](https://docs.magiceden.io) |

## Tools (24)

### Inscriptions (5)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_inscription` | Full inscription details by ID or number | `id` |
| `search_inscriptions` | Search inscriptions with filters (type, mime, date range) | `query`, `filters` |
| `get_inscription_content` | Raw content of an inscription | `id` |
| `get_inscription_transfers` | Transfer history for an inscription | `id` |
| `get_inscription_traits` | Traits and attributes of an inscription | `id` |

### Address Queries (4)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_address_inscriptions` | All inscriptions held by a Bitcoin address | `address` |
| `get_brc20_balances` | BRC-20 token balances for an address | `address` |
| `get_rune_balances` | Rune balances for an address | `address` |
| `get_address_rare_sats` | Rare satoshis held by an address | `address` |

### Runes (6)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_rune_info` | Detailed rune metadata (etching, supply, holders) | `rune` |
| `list_runes` | List all runes with pagination and sorting | `offset`, `limit` |
| `get_rune_holders` | Top holders of a specific rune | `rune` |
| `get_rune_activity` | Recent activity (mints, transfers, burns) for a rune | `rune` |
| `get_rune_market_info` | Market data -- floor price, volume, listings | `rune` |
| `get_rune_unlock_date` | Unlock/availability date for time-locked runes | `rune` |

### BRC-20 (3)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_brc20_token` | Token details (supply, limit, holders, deploy info) | `ticker` |
| `get_brc20_activity` | Recent activity for a BRC-20 token | `ticker` |
| `get_brc20_holders` | Top holders of a BRC-20 token | `ticker` |

### Collections (3)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_collection_info` | Collection metadata, floor price, volume | `slug` |
| `get_collection_inscriptions` | Inscriptions within a collection | `slug` |
| `get_collection_listings` | Active marketplace listings for a collection | `slug` |

### Sats & Transactions (3)

| Tool | Description | Key Params |
|------|-------------|------------|
| `get_sat_info` | Sat rarity, name, and inscription history | `sat_number` |
| `get_tx_inscriptions` | Inscriptions in a Bitcoin transaction | `txid` |
| `get_tx_runes` | Rune operations in a Bitcoin transaction | `txid` |

## Why This One?

- **24 tools, full coverage.** Inscriptions, runes, BRC-20, collections, rare sats, and marketplace data. No other Ordinals MCP covers all six categories.
- **Multi-API with automatic failover.** Aggregates Hiro (primary, 500 RPM), Ordiscan (fallback), and Magic Eden (marketplace). If one API rate-limits, requests automatically route to the next.
- **Intelligent caching.** TTLs tuned per data type -- sat rarity (24h), inscription metadata (5m), collection info (2m), balances (1m), marketplace listings (30s). Stale cache serves as last resort during outages.

## Architecture

```
Request --> Cache (TTL + ETag)
  |--> HIT: return cached
  |--> MISS:
      |--> Hiro (primary, 500 RPM)
      |     |--> Success: cache + return
      |     |--> Rate limited: Ordiscan (fallback) --> Stale cache (last resort)
      |--> Magic Eden (marketplace-specific)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HIRO_API_KEY` | Yes* | Hiro API key ([free](https://platform.hiro.so)) |
| `ORDISCAN_API_KEY` | Yes* | Ordiscan API key ([free](https://ordiscan.com/docs/api)) |
| `MAGIC_EDEN_API_KEY` | No | Higher marketplace rate limits |
| `CACHE_TTL_SECONDS` | No | Default cache TTL (default: 300) |

*At least one required.

## Development

```bash
git clone https://github.com/ExpertVagabond/ordinals-mcp.git
cd ordinals-mcp
npm install
npm run build
npm run inspector    # MCP Inspector for testing
```

## License

MIT -- [Purple Squirrel Media](https://github.com/ExpertVagabond)
