# Ordinals Ecosystem Data Types

> Key entities the MCP server needs to understand and expose

## 1. Inscriptions

The core primitive of Bitcoin Ordinals.

**ID format:** `{txid}i{index}` (e.g., `6fb976ab49dcec017f1e201e84395983204ae1a7c2abf7ced0a85d692e442799i0`)

**Fields:**
- `id` — Inscription ID (txid + index)
- `number` — Sequential inscription number (positive = blessed, negative = cursed)
- `address` — Current owner's Bitcoin address
- `content_type` — MIME type (image/png, text/plain, text/html, application/json, etc.)
- `content_length` — Size in bytes
- `genesis_txid` — Transaction that created the inscription
- `genesis_block_height` — Block height of inscription
- `genesis_timestamp` — Creation timestamp
- `sat_ordinal` — Ordinal number of the sat carrying the inscription
- `sat_rarity` — Rarity level (common, uncommon, rare, epic, legendary, mythic)
- `output` — Current UTXO (txid:vout)
- `offset` — Byte offset within the output
- `cursed` — Boolean (negative-numbered inscriptions)
- `recursive` — Boolean (references other inscription content)

**Content types:** Image, text, HTML, SVG, JSON, video, audio, WASM, application data

**Transfer tracking:** Each inscription has a history of `from/to/txid/block` transfers.

---

## 2. Satoshi Rarity (Rodarmor Rarity Index)

| Rarity | Definition | Approximate Supply |
|--------|-----------|-------------------|
| **Common** | Any sat not first in its block | ~2.1 quadrillion |
| **Uncommon** | First sat of each block | ~6,930,000 |
| **Rare** | First sat after difficulty adjustment | ~3,437 |
| **Epic** | First sat after a halving | ~32 (so far) |
| **Legendary** | First sat after halving + difficulty adjustment | ~5 ever |
| **Mythic** | First sat of the genesis block | 1 |

### Exotic Sat Types (collector categories)
- **Pizza sats** — From the 10,000 BTC pizza transaction
- **Vintage sats** — From first 1,000 blocks
- **Nakamoto sats** — Mined by Satoshi
- **Palindrome sats** — Ordinal number reads same forward/backward
- **Alpha sats** — First sat of each block (similar to uncommon)
- **Omega sats** — Last sat of each block
- **Block 9 sats** — First transaction between two people
- **Block 78 sats** — First non-Satoshi block

---

## 3. Runes

Fungible token protocol built into Bitcoin via `OP_RETURN`. Launched April 2024 at block 840,000.

**Fields:**
- `rune_name` — Raw name (e.g., `UNCOMMONGOODS`)
- `spaced_name` — Display name with spacers (e.g., `UNCOMMON•GOODS`)
- `symbol` — Unicode symbol (e.g., `⧉`)
- `number` — Sequential rune number
- `etching_txid` — Transaction that created the rune
- `divisibility` — Decimal places (0-38)
- `premine` — Amount premined by creator
- `supply` — Total supply (premine + minted)
- `minted` — Amount minted so far
- `turbo` — Boolean (opt-in to future protocol changes)

**Mint terms:**
- `cap` — Maximum number of mints
- `amount` — Tokens per mint
- `height_start` / `height_end` — Block height range for minting
- `offset_start` / `offset_end` — Offset from etching block

**Operations:** Etch (create), Mint, Transfer, Burn

**Balance tracking:** Per-UTXO (APIs aggregate to per-address)

---

## 4. BRC-20 Tokens

Fungible tokens via JSON inscriptions, interpreted by off-chain indexers.

**Operations (JSON inscription format):**
```json
// Deploy
{"p": "brc-20", "op": "deploy", "tick": "ordi", "max": "21000000", "lim": "1000"}

// Mint
{"p": "brc-20", "op": "mint", "tick": "ordi", "amt": "1000"}

// Transfer
{"p": "brc-20", "op": "transfer", "tick": "ordi", "amt": "100"}
```

**Fields:**
- `tick` — 4-character ticker (e.g., `ordi`, `sats`)
- `max_supply` — Maximum token supply
- `minted_supply` — Currently minted
- `limit_per_mint` — Max per mint operation
- `decimals` — Token precision
- `deploy_inscription_id` — Inscription that deployed the token

**Balance types per address:**
- `available_balance` — Can be transferred immediately
- `transferrable_balance` — Pending transfer inscriptions
- `overall_balance` — Total (available + transferrable)

---

## 5. Collections

Groups of related inscriptions (NFT collections).

**Fields:**
- `collection_id` / `symbol` — Unique identifier
- `name` — Display name
- `description` — Collection description
- `image_url` — Collection avatar/banner
- `inscription_count` — Total inscriptions in collection
- `floor_price` — Lowest listed price (BTC)
- `total_volume` — All-time trading volume
- `owner_count` — Unique holders
- `verified` — Platform verification status

**Linked data:** Individual inscriptions, traits, marketplace listings, sales history

---

## 6. Additional Entities

### Sats Names (SNS)
`.sats` domain names registered as inscriptions. Resolve to Bitcoin addresses.

### Bitmap
Blocks claimed as bitmap parcels — block numbers inscribed as `{number}.bitmap`.

### Alkanes (New — Jan 2025, block 880,000)
WASM smart contracts inscribed on Bitcoin. Supports AMMs, staking, minting. Indexed by Ordiscan.

### Recursive Inscriptions
Inscriptions that reference other inscriptions' content via `/content/<INSCRIPTION_ID>`. Enables composability — one inscription can load another's image/code.
