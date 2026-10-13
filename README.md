# Tanilo MCP server

An MCP server that connects Claude Desktop, Cursor, Windsurf or any other MCP client to the Tanilo API at `https://api.tanilo.io`.

Tanilo checks the premise before an AI agent acts. This server exposes two checks, the contract price check and the spend cap check, and two status documents. The routes it calls are live in free beta, rate-limited, no key needed. The server holds no secrets and makes no payments.

Tanilo was AgentOracle until September 2026. Versions up to 2.1.2 were published as `agentoracle-mcp`; that package is no longer maintained.

This README describes version 3.1.0. The outputs below were captured by running the tools against the live API: on 2026-10-08 for the contract price check and on 2026-10-13 for the spend cap check.

---

## Install

```bash
npx tanilo-mcp
```

### Claude Desktop

Open your Claude Desktop config file:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this and restart Claude Desktop:

```json
{
  "mcpServers": {
    "tanilo": {
      "command": "npx",
      "args": ["-y", "tanilo-mcp"]
    }
  }
}
```

Cursor (Settings → MCP → Add Server) and Windsurf (Settings → MCP Servers → Add) take the same `tanilo` block.

---

## Tools

### `check-contract-price`

Does this offer match the terms you supplied? Before an agent accepts an offer, `contract_price_match` compares the offer's unit price with the applicable term among the terms you supply, and signs the result when signing succeeds.

No model is involved: the result is arithmetic and exact comparison, and anyone holding the same input can recompute it. You supply the terms; Tanilo does not hold or look up your contracts. Three results: verified, contradicted, or indeterminate with a reason. A verified result says the price matches the supplied term. Whether to pay is your policy's decision.

Input: `offer` (`unit_price`, `currency`, `unit`, and optionally `quantity`, `seller`, `sku`, `offered_at`) and `terms` (a list; each has `agreement_id`, `version`, `currency`, `unit`, and either `price_per_unit` or `tiers`, plus optional `seller`, `product_scope`, `effective_from`, `effective_to`, `supersedes`). Prices and quantities are decimal strings such as `"2.00"`. The full input rules, tiers and amendments are at https://tanilo.io/docs/contract-price-check.

The tool returns the check result and the signed receipt. Captured live on 2026-10-08 for the docs example (an offer of USD 2.00 per call against a supplied term of USD 1.00 per call), trimmed:

```json
{
  "verdict": "halt",
  "state": "contradicted",
  "outcome": "fail",
  "reason": "price_mismatch",
  "recommendation": "offer price differs from the applicable term among the supplied terms",
  "evidence": {
    "rule_id": "contract-price-match/v0.1",
    "terms_source": "caller_supplied",
    "expected": { "price_per_unit": "1.00", "currency": "USD", "unit": "call" },
    "offered": { "unit_price": "2.00", "currency": "USD", "unit": "call", "quantity": "1" },
    "difference_per_unit": "1.00",
    "offer_is": "above_term_price"
  },
  "check_mode": "deterministic",
  "canonical_sha256": "sha256-…",
  "kid": "tanilo-2026-10-ed25519-7d885da9",
  "jwks_url": "https://tanilo.io/.well-known/jwks.json",
  "receipt": { "payload": "…", "signatures": [ … ] }
}
```

With `"terms": []` the same offer gives `state` `indeterminate`, `reason` `no_applicable_term`, `verdict` `halt`.

A valid signature shows which key signed these bytes and that they have not changed since. It does not show that the supplied terms were genuine. Check the signature offline with [`tanilo-receipt-verify`](https://github.com/TKCollective/tanilo-receipt-verify) against the key set at `https://tanilo.io/.well-known/jwks.json`:

```bash
pip install tanilo-receipt-verify
python3 -c "import json; from tanilo_receipt_verify import verify; r = verify(json.load(open('receipt.json')), jwks_by_issuer={'https://tanilo.io/.well-known/jwks.json': json.load(open('jwks.json'))}); print(r.status, r.canonical_sha256)"
```

where `receipt.json` holds the tool's `receipt` object and `jwks.json` the key set.

### `check-spend-cap`

Does this offer fit within the cap you supplied? Before an agent commits to a purchase, `spend_cap` multiplies the offer's unit price by its quantity, exactly, and compares the total with the remaining cap you supply. It signs the result when signing succeeds.

You supply the cap and `already_spent`. This check does not retrieve budget balances, maintain a running balance or reserve funds. Three results: verified, contradicted, or indeterminate with a reason. A verified result says the offer's total is within the remaining cap. Whether to pay is your policy's decision.

Input: `offer` (`unit_price`, `currency`, and optionally `quantity`, `offered_at`, `seller`, `sku`) and `cap` (`amount`, `currency`, `scope` of `per_purchase` or `per_period`, and for `per_period` `already_spent` and `period` with `from` and `to`; optionally `cap_id`). Optional `claim_hash` and `agent_id` as for `check-contract-price`. The formats are on the docs page: https://tanilo.io/docs/spend-cap-check.

The tool returns the check result and the signed receipt. Captured live on 2026-10-13 for the docs example (three calls at USD 12.50 against a USD 100.00 cap of which USD 70.00 is already spent), trimmed:

```json
{
  "verdict": "halt",
  "state": "contradicted",
  "outcome": "fail",
  "reason": "cap_exceeded",
  "recommendation": "offer total exceeds the remaining cap the caller supplied",
  "offer_total": "37.50",
  "remaining": "30.00",
  "excess": "7.50",
  "cap_already_exhausted": false,
  "evidence": {
    "rule_id": "spend-cap/v0.1",
    "cap_source": "caller_supplied",
    "offer_total": "37.50",
    "remaining": "30.00",
    "excess": "7.50",
    "cap_already_exhausted": false,
    "offer_sha256": "sha256-\u2026",
    "cap_sha256": "sha256-\u2026",
    "steps": "[ \u2026 ]"
  },
  "check_mode": "deterministic",
  "canonical_sha256": "sha256-\u2026",
  "kid": "tanilo-2026-10-ed25519-7d885da9",
  "jwks_url": "https://tanilo.io/.well-known/jwks.json",
  "receipt": {
    "payload": "\u2026",
    "signatures": "[ \u2026 ]"
  }
}
```

With `"already_spent": "62.50"` the same offer is exactly at the cap: `state` `verified`, `remaining` `37.50`, `excess` `null`, `verdict` `act`.

Verify the receipt's signature against a key set you have authenticated as Tanilo's, as for `check-contract-price`. A valid signature establishes that the signed content verifies under the selected key and has not been altered. It does not establish that the supplied cap is authentic, approved or current, or that the purchase is authorized.

### `check-health`

Returns the API's status document (`GET /health`): service status, the live routes and their prices, the retired routes, and rate limits.

### `get-manifest`

Returns the API's discovery document (`GET /.well-known/x402-manifest.json`). It lists no payable resources: the paid research routes were retired on 2026-10-04.

---

## What this server does not do

- It has no tool for Tanilo's claim check (`POST /evaluate`) yet. The route is free during the beta and can be called directly; see https://tanilo.io/pricing.
- It does not pay for anything, hold a wallet, or read any key. The x402 payment code of earlier versions is gone.
- It does not verify signatures itself; use `tanilo-receipt-verify` as above.

## Development

```bash
npm install
npm run build
npm test          # starts the built server over stdio and calls the live API (free beta route)
```

Set `TANILO_PYTHON` to a Python that has `tanilo-receipt-verify` installed and the test also verifies the returned receipt's signature offline. Set `TANILO_API_BASE` to point the server at another host (tests only).

---

## Links

- [tanilo.io](https://tanilo.io) — site and documentation
- [tanilo.io/docs/contract-price-check](https://tanilo.io/docs/contract-price-check) — the check this server exposes
- [tanilo.io/trust](https://tanilo.io/trust) — keys, and what a signature does and does not establish
- [tanilo-receipt-spec](https://github.com/TKCollective/tanilo-receipt-spec) — the receipt format
- [tanilo-receipt-verify](https://github.com/TKCollective/tanilo-receipt-verify) — offline signature check

Contact: joe@tanilo.io

MIT licensed. TK Collective LLC.
