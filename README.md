# :link: ordinals-mcp

[![npm version](https://img.shields.io/npm/v/ordinals-mcp.svg)](https://www.npmjs.com/package/ordinals-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/ExpertVagabond/ordinals-mcp)](https://github.com/ExpertVagabond/ordinals-mcp/stargazers)
[![Website](https://img.shields.io/badge/website-ordinals--mcp.pages.dev-f7931a)](https://ordinals-mcp.pages.dev)

**Bitcoin Ordinals MCP Server** -- multi-API access to inscriptions, runes, BRC-20 tokens, collections, marketplace data, and rare sats via [Model Context Protocol](https://modelcontextprotocol.io). Aggregates data from Hiro, Ordiscan, and Magic Eden with built-in caching and rate limiting.

## Install

```bash
npx ordinals-mcp@latest
```

Add to your MCP config (Claude Desktop / Claude Code):

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

### API Keys (free)

| Provider | Rate Limit | Link |
|----------|-----------|------|
| **Hiro** (primary) | 500 RPM | [platform.hiro.so](https://platform.hiro.so) |
| **Ordiscan** (fallback) | -- | [ordiscan.com/docs/api](https://ordiscan.com/docs/api) |
| **Magic Eden** (optional) | -- | [docs.magiceden.io](https://docs.magiceden.io) |

At least one of `HIRO_API_KEY` or `ORDISCAN_API_KEY` is required.

## 24 Tools

| Category | Tools |
|----------|-------|
| **Inscriptions** (5) | `get_inscription`, `search_inscriptions`, `get_inscription_content`, `get_inscription_transfers`, `get_inscription_traits` |
| **Address** (4) | `get_address_inscriptions`, `get_brc20_balances`, `get_rune_balances`, `get_address_rare_sats` |
| **Runes** (6) | `get_rune_info`, `list_runes`, `get_rune_holders`, `get_rune_activity`, `get_rune_market_info`, `get_rune_unlock_date` |
| **BRC-20** (3) | `get_brc20_token`, `get_brc20_activity`, `get_brc20_holders` |
| **Collections** (3) | `get_collection_info`, `get_collection_inscriptions`, `get_collection_listings` |
| **Sats & Txs** (3) | `get_sat_info`, `get_tx_inscriptions`, `get_tx_runes` |

## Usage Example

```
You: What runes does bc1q...abc hold?
Claude: [calls get_rune_balances] This address holds 3 runes:
  - DOG*GO*TO*THE*MOON: 1,500,000
  - RSIC: 21,000
  - PUPS: 500

You: Show me the floor price for the Bitcoin Puppets collection
Claude: [calls get_collection_info] Bitcoin Puppets floor: 0.12 BTC ($7,200), 24h volume: 2.3 BTC
```

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

**Intelligent Caching**: Sat rarity (24h), inscription metadata (5m), collection info (2m), balances (1m), marketplace listings (30s).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HIRO_API_KEY` | Yes* | Hiro API key |
| `ORDISCAN_API_KEY` | Yes* | Ordiscan API key |
| `MAGIC_EDEN_API_KEY` | No | Higher marketplace rate limits |
| `CACHE_TTL_SECONDS` | No | Default cache TTL (default: 300) |

## Development

```bash
npm install && npm run build
npm run inspector    # MCP Inspector for testing
```

## Related Projects

- [cpanel-mcp](https://github.com/ExpertVagabond/cpanel-mcp) -- cPanel hosting MCP server
- [solana-mcp-server-app](https://github.com/ExpertVagabond/solana-mcp-server-app) -- Solana wallet + DeFi MCP
- [coldstar-colosseum](https://github.com/ExpertVagabond/coldstar-colosseum) -- Air-gapped Solana vault

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

## Links

- [Website](https://ordinals-mcp.pages.dev) | [npm](https://www.npmjs.com/package/ordinals-mcp) | [Setup Gist](https://gist.github.com/ExpertVagabond/6448a5c0a1c8a71bee3e8d598cb7e17e)

## License

MIT -- [Purple Squirrel Media](https://github.com/ExpertVagabond)
