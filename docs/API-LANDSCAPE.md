# Bitcoin Ordinals API Landscape

> Research compiled 2026-02-13 for building ordinals-mcp

## API Provider Summary

| Provider | Base URL | Auth | Free RPM | Best For |
|----------|----------|------|----------|----------|
| **Hiro** | `api.hiro.so/ordinals/v1` | API key header | 500 (key), 50 (no key) | Inscriptions, BRC-20, Runes — most reliable |
| **Ordiscan** | `api.ordiscan.com` | Bearer token | Daily limits | TypeScript SDK, rare sats, alkanes |
| **BestInSlot** | `api.bestinslot.xyz/v3` | `x-api-key` header | Daily (free trial) | Collections, UTXO, mempool, bitmap |
| **Magic Eden** | `api-mainnet.magiceden.dev/v2/ord` | Optional key | 30 QPM | Marketplace listings, floor prices, sales |
| **OrdinalsBot** | `api.ordinalsbot.com` | API key | 12/min (inscribe) | Write ops: inscribe, etch runes |
| **QuickNode** | Per-account endpoint | Subscription | Per plan | JSON-RPC interface |
| **ord server** | `localhost:80` (self-hosted) | None | Unlimited | Full node, self-hosted |

---

## 1. Hiro Ordinals API (PRIMARY)

**Why primary:** Highest free rate limit (500 RPM), open-source indexer, ETag caching support, most endpoints.

### Ordinals Endpoints (`/ordinals/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/inscriptions` | List inscriptions with filters (block, sat range, address, mime, rarity) |
| GET | `/inscriptions/{id}` | Inscription metadata by ID or number |
| GET | `/inscriptions/{id}/content` | Raw inscription content |
| GET | `/inscriptions/{id}/transfers` | Transfer history |
| GET | `/inscriptions/transfers` | Transfers per block |
| GET | `/sats/{ordinal}` | Sat data by ordinal number |
| GET | `/sats/{ordinal}/inscriptions` | Inscriptions on a sat |
| GET | `/stats/inscriptions` | Global inscription stats |
| GET | `/brc-20/tokens` | List BRC-20 tokens |
| GET | `/brc-20/tokens/{ticker}` | Token details |
| GET | `/brc-20/tokens/{ticker}/holders` | Token holders |
| GET | `/brc-20/activity` | Deploy/mint/transfer events |
| GET | `/brc-20/balances/{address}` | BRC-20 balances for address |

### Runes Endpoints (`/runes/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/etchings` | List all rune etchings |
| GET | `/etchings/{name}` | Rune details (symbol, supply, terms) |
| GET | `/etchings/{name}/holders` | Rune holders |
| GET | `/etchings/{name}/activity` | Rune activity |
| GET | `/activity` | Global rune activity |
| GET | `/addresses/{address}/balances` | Rune balances for address |

**Docs:** https://docs.hiro.so/bitcoin/ordinals/api
**Keys:** https://platform.hiro.so
**Indexer:** https://github.com/hirosystems/ordinals-api

---

## 2. Ordiscan API (SECONDARY + SDK)

**Why secondary:** Official TypeScript SDK (`npm install ordiscan`), covers rare sats and alkanes.

### SDK Methods (`ordiscan` npm v1.1.0)

```typescript
import { Ordiscan } from 'ordiscan';
const client = new Ordiscan('YOUR_KEY');

// Inscriptions
client.inscription.getInfo({ id })
client.inscription.list({ /* filters */ })

// Address
client.address.getInscriptions({ address })
client.address.getRunes({ address })
client.address.getRareSats({ address })
client.address.getBrc20({ address })

// Collections
client.collection.getInscriptions({ slug })
client.collection.getInfo({ slug })

// Runes
client.rune.getInfo({ name })
client.rune.list()
client.rune.getMarketInfo({ name })
client.rune.getMintInfo({ name })
client.rune.getNameUnlockDate({ name })

// UTXOs
client.utxo.getRareSats({ txid, vout })

// Transactions
client.tx.getInscriptions({ txid })
client.tx.getRunes({ txid })
```

### Endpoint Categories

| Category | Capabilities |
|----------|-------------|
| Inscriptions | List, info, content, traits, search |
| Collections | List, info, inscriptions, market cap/price |
| Runes | List, info, market (price/mcap), mint, name unlocks |
| BRC-20 | Token info, balances, activity |
| Addresses | Inscriptions, runes, BRC-20, rare sats, UTXOs |
| Transactions | TX info, inscriptions in TX, runes in TX |
| Rare Sats | Sat info by ordinal, rare sats in UTXO |
| Alkanes | List, info by ID (new metaprotocol, Jan 2025) |

**Docs:** https://ordiscan.com/docs/api
**SDK:** https://github.com/ordiscan/ordiscan-sdk

---

## 3. BestInSlot API (COMPREHENSIVE FALLBACK)

**Why:** Most comprehensive coverage — collections, mempool, bitmap, sats names, BIP-322 verification. Multi-network (mainnet, testnet4, signet).

### Endpoint Categories

| Category | Key Endpoints |
|----------|--------------|
| Collections | List, info, floor prices, volumes, listings |
| Inscriptions | List, info, detail, by address |
| Wallets | Inscriptions, collections, verified sats, listings, activity, batch queries |
| BRC-20 | Token info (`ticker_info`), balances, deploy/mint/transfer history |
| Runes | Info, wallet activity, balances |
| Sats Names | SNS lookups |
| Bitmap | Bitmap parcels |
| BIP-322 | Signature verification (`/v3/bip322/verify`) |
| Mempool | All UTXOs, cardinal UTXOs, ordinal UTXOs, runic UTXOs |

**Docs:** https://docs.bestinslot.xyz/
**Note:** All plans require API key. Contact them for access.

---

## 4. Magic Eden Ordinals API (MARKETPLACE)

**Why:** Best for marketplace data — listings, sales, floor prices, offers.

### Key Endpoints (`/v2/ord/btc`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tokens` | Filter by collection, owner, tokenIds |
| GET | `/collections` | Collection listings, stats |
| GET | `/activities` | Collection/wallet activities |
| GET | `/runes/wallet/activities/{address}` | Rune wallet activity |
| GET | `/stat` | Market statistics |

**Docs:** https://docs.magiceden.io/reference/ordinals-overview
**Rate limit:** 30 QPM default, higher with API key.

---

## 5. OrdinalsBot API (WRITE OPERATIONS)

**Why:** Only API for creating inscriptions and etching runes programmatically.

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/inscribe` | Create inscription order |
| POST | `/runes/etch` | Etch a new rune |
| POST | `/runes/launchpad/create` | Rune launchpad |
| POST | `/collectioncreate` | Recursive HTML collections |
| GET | `/order` | Check order status |
| GET | `/opi/v1/brc20/ticker_info` | BRC-20 token info |

**Docs:** https://docs.ordinalsbot.com/
**SDK:** https://github.com/ordinalsbot/ordinalsbot-node
**Limits:** `/inscribe` = 2 req/10 sec, 10K files/order, 50MB/call
