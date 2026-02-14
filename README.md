# ordinals-mcp

[![npm version](https://img.shields.io/npm/v/ordinals-mcp.svg)](https://www.npmjs.com/package/ordinals-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bitcoin Ordinals MCP Server — multi-API access to inscriptions, runes, BRC-20 tokens, collections, marketplace data, and rare sats.

A [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI models comprehensive access to the Bitcoin Ordinals ecosystem. Aggregates data from multiple APIs with built-in caching and rate limiting.

## Quick Start

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "ordinals": {
      "command": "npx",
      "args": ["ordinals-mcp@latest"],
      "env": {
        "HIRO_API_KEY": "your-key",
        "ORDISCAN_API_KEY": "your-key"
      }
    }
  }
}
```

### Get API Keys (free)

- **Hiro** (primary, 500 RPM): [platform.hiro.so](https://platform.hiro.so)
- **Ordiscan** (secondary): [ordiscan.com/docs/api](https://ordiscan.com/docs/api)
- **Magic Eden** (marketplace, optional): [docs.magiceden.io](https://docs.magiceden.io)

At least one of `HIRO_API_KEY` or `ORDISCAN_API_KEY` is required.

## 24 Tools

### Inscriptions

| Tool | Description |
|------|-------------|
| `get_inscription` | Get inscription metadata by ID or number |
| `search_inscriptions` | Search/filter inscriptions (address, mime type, rarity, block range) |
| `get_inscription_content` | Get raw inscription content (text, images, etc.) |
| `get_inscription_transfers` | Get transfer history for an inscription |
| `get_inscription_traits` | Get trait info for collection inscriptions |

### Address Lookups

| Tool | Description |
|------|-------------|
| `get_address_inscriptions` | All inscriptions owned by an address |
| `get_brc20_balances` | BRC-20 token balances for an address |
| `get_rune_balances` | Rune balances for an address |
| `get_address_rare_sats` | Rare satoshis held by an address |

### Runes

| Tool | Description |
|------|-------------|
| `get_rune_info` | Rune details (symbol, supply, mint terms) |
| `list_runes` | List all runes with pagination |
| `get_rune_holders` | Top holders of a rune |
| `get_rune_activity` | Recent mints, transfers, burns |
| `get_rune_market_info` | Price, market cap, 24h volume |
| `get_rune_unlock_date` | When a rune name becomes available |

### BRC-20

| Tool | Description |
|------|-------------|
| `get_brc20_token` | Token details (supply, mint limit, decimals) |
| `get_brc20_activity` | Deploy, mint, transfer events |
| `get_brc20_holders` | Top holders of a BRC-20 token |

### Collections & Marketplace

| Tool | Description |
|------|-------------|
| `get_collection_info` | Collection stats, floor price, volume |
| `get_collection_inscriptions` | List inscriptions in a collection |
| `get_collection_listings` | Active Magic Eden marketplace listings |

### Satoshis & Transactions

| Tool | Description |
|------|-------------|
| `get_sat_info` | Sat rarity, epoch, inscriptions |
| `get_tx_inscriptions` | Inscriptions in a transaction |
| `get_tx_runes` | Rune transfers in a transaction |

## Architecture

### Multi-API with Fallback

```
Request -> Cache (TTL + ETag)
  |-> HIT: return cached
  |-> MISS:
      |-> Hiro (primary, 500 RPM)
      |   |-> Success: cache + return
      |   |-> Rate limited:
      |       |-> Ordiscan (fallback)
      |       |-> Stale cache (last resort)
      |-> Magic Eden (marketplace-specific)
```

### Built-in Rate Limiting

Per-API token bucket rate limiters with 80% safety margin. Automatic wait-and-retry when approaching limits.

### Intelligent Caching

| Data Type | TTL |
|-----------|-----|
| Sat rarity | 24 hours |
| Inscription metadata | 5 minutes |
| Rune etching info | 5 minutes |
| Collection info | 2 minutes |
| Balances | 1 minute |
| Marketplace listings | 30 seconds |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HIRO_API_KEY` | Yes* | Hiro API key (500 RPM) |
| `ORDISCAN_API_KEY` | Yes* | Ordiscan API key |
| `MAGIC_EDEN_API_KEY` | No | Higher marketplace rate limits |
| `CACHE_TTL_SECONDS` | No | Default cache TTL (default: 300) |
| `RATE_LIMIT_BUFFER` | No | Rate limit safety margin (default: 0.8) |

*At least one API key is required.

## Development

```bash
npm install
npm run build          # TypeScript + esbuild bundle
npm run watch          # TypeScript watch mode
npm run inspector      # MCP Inspector for testing
```

## License

MIT
