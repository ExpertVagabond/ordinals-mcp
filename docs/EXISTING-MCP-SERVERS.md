# Existing Bitcoin Ordinals MCP Servers

> Competitive landscape as of 2026-02-13

## 1. ordiscan-mcp (Official Ordiscan) — Best existing

- **GitHub:** https://github.com/ordiscan/ordiscan-mcp
- **npm:** `ordiscan-mcp` (v0.1.3)
- **Language:** TypeScript
- **SDK:** `@modelcontextprotocol/sdk` v1.8.0 + `ordiscan` v1.1.0
- **Transport:** StdioServerTransport
- **Auth:** `ORDISCAN_API_KEY` env var (free)
- **License:** MIT

### 17 Tools

| Tool | Description |
|------|-------------|
| `inscription_list` | List inscriptions |
| `inscription_info` | Get inscription details |
| `inscription_traits` | Inscription trait info |
| `inscribe` | Create inscription (via Ordiscan) |
| `sat_info` | Sat details |
| `rune_list` | List runes |
| `rune_info` | Rune details |
| `rune_mint` | Rune mint info |
| `rune_market_info` | Rune price/market |
| `rune_name_unlock` | Name unlock date |
| `collection_info` | Collection details |
| `address_inscriptions` | Inscriptions for address |
| `address_runes` | Rune balances for address |
| `address_brc20` | BRC-20 balances for address |
| `address_rare_sats` | Rare sat balances |
| `tx_inscriptions` | Inscriptions in a TX |
| `tx_runes` | Runes in a TX |

### Architecture

Clean action-based pattern:
- `src/actions/{category}/` — Each tool is a separate file
- `src/ordiscan-client.ts` — Single API client wrapper
- `src/types.ts` — McpAction interface (tool + handler)
- `src/index.ts` — Server entry with tool registration
- Uses zod for schema validation
- ~500 lines total

### Gaps

- Single API (Ordiscan only) — no fallback
- No marketplace data (listings, floor prices, sales)
- No BRC-20 activity/history
- No rune holders or activity data
- No inscription content retrieval
- No mempool/UTXO data
- No caching or rate limiting
- No streaming/SSE transport
- No multi-API fallback

---

## 2. mcp-inscription (by Laz1mov) — Minimal

- **GitHub:** https://github.com/Laz1mov/mcp-inscription
- **Language:** TypeScript
- **Transport:** STDIO + SSE
- **Auth:** None required (reads raw blockchain data)

### 1 Tool

| Tool | Description |
|------|-------------|
| `show_ordinals` | Decode inscription content from transaction witness data |

### Assessment

Extremely limited. Only decodes inscriptions from raw transactions. No search, no runes, no BRC-20, no collections, no marketplace. Not a competitor.

---

## 3. bitcoin-mcp (by JamesANZ) — General BTC, not Ordinals

- **GitHub:** https://github.com/JamesANZ/bitcoin-mcp
- **npm:** `@jamesanz/bitcoin-mcp`
- **Focus:** General Bitcoin blockchain data via mempool.space
- **Not Ordinals-specific** — no inscription, rune, or BRC-20 support

---

## 4. bitcoinjs-mcp-server (by Odyssey98) — Dev tools, not Ordinals

- **GitHub:** https://github.com/Odyssey98/bitcoinjs-mcp-server
- **Focus:** Bitcoin dev tools (address generation, tx creation, script compilation)
- **Not Ordinals-specific**

---

## Opportunity

The market has exactly one real Ordinals MCP (ordiscan-mcp) with significant gaps. Building a multi-API, 28-tool MCP with caching, rate limiting, marketplace data, and write operations would be a clear upgrade and potentially the definitive Ordinals MCP server.
