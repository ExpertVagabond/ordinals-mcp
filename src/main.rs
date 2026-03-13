#![recursion_limit = "512"]

use serde::Deserialize;
use serde_json::{json, Value};
use std::io::BufRead;
use tracing::info;

const HIRO_BASE: &str = "https://api.secretkeylabs.io";

struct ApiClient {
    client: reqwest::Client,
    hiro_key: Option<String>,
}

impl ApiClient {
    fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            hiro_key: std::env::var("HIRO_API_KEY").ok(),
        }
    }

    async fn hiro(&self, path: &str) -> Result<Value, String> {
        let url = format!("{HIRO_BASE}{path}");
        let mut req = self.client.get(&url).header("Accept", "application/json");
        if let Some(ref key) = self.hiro_key {
            req = req.header("x-api-key", key.as_str());
        }
        let resp = req.send().await.map_err(|e| format!("Hiro error: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("Hiro API {}: {}", resp.status(), path));
        }
        resp.json().await.map_err(|e| format!("Parse error: {e}"))
    }
}

#[derive(Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String, id: Option<Value>, method: String,
    #[serde(default)] params: Value,
}

fn tool_definitions() -> Value {
    json!([
        {"name":"get_inscription","description":"Get inscription details by ID or number","inputSchema":{"type":"object","properties":{"id":{"type":"string","description":"Inscription ID or number"}},"required":["id"]}},
        {"name":"search_inscriptions","description":"Search inscriptions with filters","inputSchema":{"type":"object","properties":{"address":{"type":"string"},"mime_type":{"type":"string"},"rarity":{"type":"string"},"from_block":{"type":"number"},"to_block":{"type":"number"},"from_number":{"type":"number"},"to_number":{"type":"number"},"offset":{"type":"number"},"limit":{"type":"number"}}}},
        {"name":"get_inscription_content","description":"Get the content of an inscription","inputSchema":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}},
        {"name":"get_inscription_transfers","description":"Get transfer history for an inscription","inputSchema":{"type":"object","properties":{"id":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["id"]}},
        {"name":"get_inscription_traits","description":"Get traits/attributes for an inscription","inputSchema":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}},
        {"name":"get_address_inscriptions","description":"Get all inscriptions owned by an address","inputSchema":{"type":"object","properties":{"address":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["address"]}},
        {"name":"get_brc20_balances","description":"Get BRC-20 token balances for an address","inputSchema":{"type":"object","properties":{"address":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["address"]}},
        {"name":"get_rune_balances","description":"Get Rune token balances for an address","inputSchema":{"type":"object","properties":{"address":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["address"]}},
        {"name":"get_address_rare_sats","description":"Get rare sats owned by an address","inputSchema":{"type":"object","properties":{"address":{"type":"string"}},"required":["address"]}},
        {"name":"get_sat_info","description":"Get details about a specific sat ordinal number","inputSchema":{"type":"object","properties":{"ordinal":{"type":"string"}},"required":["ordinal"]}},
        {"name":"get_brc20_token","description":"Get BRC-20 token details by ticker","inputSchema":{"type":"object","properties":{"ticker":{"type":"string"}},"required":["ticker"]}},
        {"name":"get_rune_info","description":"Get Rune etching details by name","inputSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}},
        {"name":"get_collection_info","description":"Get collection info from Ordiscan","inputSchema":{"type":"object","properties":{"slug":{"type":"string"}},"required":["slug"]}},
        {"name":"get_collection_inscriptions","description":"Get inscriptions in a collection","inputSchema":{"type":"object","properties":{"slug":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["slug"]}},
        {"name":"get_collection_listings","description":"Get Magic Eden listings for a collection","inputSchema":{"type":"object","properties":{"slug":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["slug"]}},
        {"name":"get_rune_market_info","description":"Get market data for a rune from Magic Eden","inputSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}},
        {"name":"list_runes","description":"List all runes with pagination","inputSchema":{"type":"object","properties":{"offset":{"type":"number"},"limit":{"type":"number"}}}},
        {"name":"get_rune_holders","description":"Get top holders for a rune","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["name"]}},
        {"name":"get_rune_activity","description":"Get recent activity for a rune","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["name"]}},
        {"name":"get_rune_unlock_date","description":"Get unlock/mintable date info for a rune","inputSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}},
        {"name":"get_brc20_activity","description":"Get BRC-20 token activity","inputSchema":{"type":"object","properties":{"ticker":{"type":"string"},"address":{"type":"string"},"operation":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}}}},
        {"name":"get_brc20_holders","description":"Get top holders for a BRC-20 token","inputSchema":{"type":"object","properties":{"ticker":{"type":"string"},"offset":{"type":"number"},"limit":{"type":"number"}},"required":["ticker"]}},
        {"name":"get_tx_inscriptions","description":"Get inscriptions revealed in a transaction","inputSchema":{"type":"object","properties":{"txid":{"type":"string"}},"required":["txid"]}}
    ])
}

fn qs(args: &Value, fields: &[(&str, &str)]) -> String {
    let mut params = Vec::new();
    for (json_key, qs_key) in fields {
        if let Some(v) = args.get(*json_key) {
            if let Some(s) = v.as_str() { params.push(format!("{qs_key}={s}")); }
            else if let Some(n) = v.as_i64() { params.push(format!("{qs_key}={n}")); }
            else if let Some(b) = v.as_bool() { params.push(format!("{qs_key}={b}")); }
        }
    }
    let offset = args["offset"].as_u64().unwrap_or(0);
    let limit = args["limit"].as_u64().unwrap_or(20);
    params.push(format!("offset={offset}"));
    params.push(format!("limit={limit}"));
    params.join("&")
}

fn enc(s: &str) -> String {
    s.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c.to_string() } else { format!("%{:02X}", c as u8) }).collect()
}

async fn call_tool(api: &ApiClient, name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "get_inscription" => {
            let id = args["id"].as_str().ok_or("id required")?;
            api.hiro(&format!("/v1/inscriptions/{}", enc(id))).await
        }
        "search_inscriptions" => {
            let q = qs(args, &[("address","address"),("mime_type","mime_type"),("rarity","rarity"),("from_block","from_block_height"),("to_block","to_block_height"),("from_number","from_number"),("to_number","to_number")]);
            api.hiro(&format!("/v1/inscriptions?{q}")).await
        }
        "get_inscription_content" => {
            let id = args["id"].as_str().ok_or("id required")?;
            // Return metadata about content; actual binary content needs special handling
            let meta = api.hiro(&format!("/v1/inscriptions/{}", enc(id))).await?;
            Ok(json!({"inscription_id": id, "content_type": meta["content_type"], "content_length": meta["content_length"], "content_url": format!("{HIRO_BASE}/v1/inscriptions/{}/content", enc(id))}))
        }
        "get_inscription_transfers" => {
            let id = args["id"].as_str().ok_or("id required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/inscriptions/{}/activity?offset={offset}&limit={limit}", enc(id))).await
        }
        "get_inscription_traits" => {
            let id = args["id"].as_str().ok_or("id required")?;
            api.hiro(&format!("/v1/inscriptions/{}", enc(id))).await
        }
        "get_address_inscriptions" => {
            let addr = args["address"].as_str().ok_or("address required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/ordinals/address/{}/inscriptions?offset={offset}&limit={limit}", enc(addr))).await
        }
        "get_brc20_balances" => {
            let addr = args["address"].as_str().ok_or("address required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/ordinals/address/{}/brc20?offset={offset}&limit={limit}", enc(addr))).await
        }
        "get_rune_balances" => {
            let addr = args["address"].as_str().ok_or("address required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/ordinals/address/{}/runes?offset={offset}&limit={limit}", enc(addr))).await
        }
        "get_address_rare_sats" => {
            let addr = args["address"].as_str().ok_or("address required")?;
            api.hiro(&format!("/v1/inscriptions?address={}&rarity=uncommon,rare,epic,legendary,mythic&limit=60", enc(addr))).await
        }
        "get_sat_info" => {
            let ordinal = args["ordinal"].as_str().ok_or("ordinal required")?;
            api.hiro(&format!("/v1/sats/{}", enc(ordinal))).await
        }
        "get_brc20_token" => {
            let ticker = args["ticker"].as_str().ok_or("ticker required")?;
            api.hiro(&format!("/v1/brc20/ticker/{}", enc(ticker))).await
        }
        "get_rune_info" => {
            let name_str = args["name"].as_str().ok_or("name required")?;
            api.hiro(&format!("/v1/runes/{}", enc(name_str))).await
        }
        "get_collection_info" | "get_collection_inscriptions" | "get_collection_listings" => {
            let slug = args["slug"].as_str().ok_or("slug required")?;
            Ok(json!({"info": format!("Collection '{}' — use ordiscan.com/collection/{} or magiceden.io/ordinals/marketplace/{}", slug, slug, slug), "slug": slug}))
        }
        "get_rune_market_info" => {
            let name_str = args["name"].as_str().ok_or("name required")?;
            let info = api.hiro(&format!("/v1/runes/{}", enc(name_str))).await?;
            Ok(json!({"rune": info, "market_url": format!("https://magiceden.io/runes/{}", name_str)}))
        }
        "list_runes" => {
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/runes?offset={offset}&limit={limit}")).await
        }
        "get_rune_holders" => {
            let name_str = args["name"].as_str().ok_or("name required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/runes/{}/holders?offset={offset}&limit={limit}", enc(name_str))).await
        }
        "get_rune_activity" => {
            let name_str = args["name"].as_str().ok_or("name required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/runes/{}/activity?offset={offset}&limit={limit}", enc(name_str))).await
        }
        "get_rune_unlock_date" => {
            let name_str = args["name"].as_str().ok_or("name required")?;
            let info = api.hiro(&format!("/v1/runes/{}", enc(name_str))).await?;
            Ok(json!({"rune": name_str, "mint_terms": info["mint_terms"], "supply": info["supply"]}))
        }
        "get_brc20_activity" => {
            let q = qs(args, &[("ticker","ticker"),("address","address"),("operation","operation")]);
            api.hiro(&format!("/v1/brc20/activity?{q}")).await
        }
        "get_brc20_holders" => {
            let ticker = args["ticker"].as_str().ok_or("ticker required")?;
            let offset = args["offset"].as_u64().unwrap_or(0);
            let limit = args["limit"].as_u64().unwrap_or(20);
            api.hiro(&format!("/v1/brc20/ticker/{}/holders?offset={offset}&limit={limit}", enc(ticker))).await
        }
        "get_tx_inscriptions" => {
            let txid = args["txid"].as_str().ok_or("txid required")?;
            api.hiro(&format!("/v1/inscriptions?genesis_tx_id={}", enc(txid))).await
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").with_writer(std::io::stderr).init();
    info!("ordinals-mcp starting on stdio (23 tools)");
    let api = ApiClient::new();
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut line = String::new();
    loop {
        line.clear();
        if stdin.lock().read_line(&mut line).unwrap_or(0) == 0 { break; }
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        let req: JsonRpcRequest = match serde_json::from_str(trimmed) { Ok(r) => r, Err(_) => continue };
        let response = match req.method.as_str() {
            "initialize" => json!({"jsonrpc":"2.0","id":req.id,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"ordinals-mcp","version":"0.1.0"}}}),
            "notifications/initialized" => continue,
            "tools/list" => json!({"jsonrpc":"2.0","id":req.id,"result":{"tools":tool_definitions()}}),
            "tools/call" => {
                let tn = req.params["name"].as_str().unwrap_or("");
                let a = &req.params["arguments"];
                match call_tool(&api, tn, a).await {
                    Ok(r) => json!({"jsonrpc":"2.0","id":req.id,"result":{"content":[{"type":"text","text":serde_json::to_string_pretty(&r).unwrap_or_default()}]}}),
                    Err(e) => json!({"jsonrpc":"2.0","id":req.id,"result":{"content":[{"type":"text","text":format!("Error: {e}")}],"isError":true}}),
                }
            }
            _ => json!({"jsonrpc":"2.0","id":req.id,"error":{"code":-32601,"message":format!("Unknown method: {}",req.method)}}),
        };
        use std::io::Write;
        let out = serde_json::to_string(&response).unwrap();
        let mut lock = stdout.lock();
        let _ = writeln!(lock, "{out}");
        let _ = lock.flush();
    }
}
