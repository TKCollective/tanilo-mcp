# Tanilo MCP server

An MCP server that connects Claude Desktop, Cursor, Windsurf or any other MCP client to the Tanilo API.

Tanilo was AgentOracle until September 2026. The npm package is still named `agentoracle-mcp`, and will be until a `tanilo-mcp` package is published. The server still calls the API at `agentoracle.co`, which serves the same API as `api.tanilo.io`.

This README describes version 2.1.2 as it behaved on 2026-10-03, when every tool was run once against the live API with no wallet configured.

---

## Install

```bash
npx agentoracle-mcp
```

No API key and no account are needed for the tools listed under "What works today".

### Claude Desktop

Open your Claude Desktop config file:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this:

```json
{
  "mcpServers": {
    "agentoracle": {
      "command": "npx",
      "args": ["-y", "agentoracle-mcp"]
    }
  }
}
```

Restart Claude Desktop.

### Cursor

Open Cursor Settings → MCP → Add Server:

```json
{
  "agentoracle": {
    "command": "npx",
    "args": ["-y", "agentoracle-mcp"]
  }
}
```

### Windsurf

Open Windsurf Settings → MCP Servers → Add:

```json
{
  "agentoracle": {
    "command": "npx",
    "args": ["-y", "agentoracle-mcp"]
  }
}
```

---

## What works today

| Tool | What it returned on 2026-10-03 |
|---|---|
| `preview` | A short summary, up to two key facts and a confidence score for a question or claim. Free, limited to about 10 calls per hour per IP address. |
| `check-health` | The API's status document. |
| `get-manifest` | The API's discovery manifest. |

Sample `preview` output, captured live on 2026-10-03 for the query "Paris is the capital of France." and trimmed:

```json
{
  "preview": true,
  "query": "Paris is the capital of France.",
  "result": {
    "summary": "The statement is true: Paris is the capital of France.",
    "key_facts": [
      "Britannica identifies Paris as the national capital of France.",
      "Multiple retrieved sources, including Britannica, BBC, EBSCO, and Wikipedia, confirm this."
    ],
    "confidence_score": 1
  },
  "preview_remaining": 9,
  "preview_limit": "10/hour per IP (approximate — serverless instances may vary)"
}
```

A preview is a model-written summary. It is not a signed receipt and it is not proof that the claim is true.

## What is in the package but not documented as working

- `research`, `deep-research` and `batch-research` call the research routes (`POST /research`, `/deep-research`, `/research/batch`). Those routes ask for x402 payment in USDC on Base. On 2026-10-03, with no wallet configured, each route answered HTTP 402 with payment requirements and the tool returned `payment_required`. No payment was attempted in that check, so this README does not say that a payment completes or what a paid call returns.
- `resolve` asks a third-party directory (Decixa) for an endpoint. On 2026-10-03 the directory answered HTTP 403 and the tool fell back to a built-in entry.

## What this server does not do yet

Version 2.1.2 has no tool for Tanilo's claim check (`POST /evaluate`) or its deterministic check (`POST /v1/verify-facts`), so no tool in this server returns a signed receipt. Both routes are free during the beta (no key, rate-limited) and can be called directly:

```bash
curl -X POST https://api.tanilo.io/evaluate \
  -H "Content-Type: application/json" \
  -d '{"content": "Paris is the capital of France."}'
```

Part of the response to that request, captured live on 2026-10-03 and trimmed:

```json
{
  "evaluation": {
    "overall_confidence": 1,
    "recommendation": "act",
    "total_claims": 1,
    "verification_method": "model-checks",
    "claims": [
      {
        "claim": "Paris is the capital of France.",
        "verdict": "supported",
        "confidence": 1,
        "adversarial_result": "resistant"
      }
    ]
  },
  "receipt": {
    "canonical_sha256": "sha256-7b83b120899ea368c2397b9ec0832ae3e0499b430b8245e184b45c37112e1edc",
    "kid": "tanilo-2026-10-ed25519-7d885da9",
    "envelope_kind": "verification.v0.3+composed",
    "verdict": "act",
    "v_recommendation": "confident_supported"
  }
}
```

How `/evaluate` reaches a result: model checks, including one that argues against the claim, combined under a published rule. Sources are listed with the result for reference; they don't feed the verdict yet.

The receipt is signed. Anyone can check the signature offline with [`tanilo-receipt-verify`](https://github.com/TKCollective/tanilo-receipt-verify) against the key set at `https://tanilo.io/.well-known/jwks.json`. A valid signature shows which key signed those bytes. It is not proof that the claim is true.

---

## Links

- [tanilo.io](https://tanilo.io) — site and documentation
- [tanilo.io/trust](https://tanilo.io/trust) — keys, and what a signature does and does not establish
- [tanilo-receipt-spec](https://github.com/TKCollective/tanilo-receipt-spec) — the receipt format
- [tanilo-receipt-verify](https://github.com/TKCollective/tanilo-receipt-verify) — offline signature check

Contact: joe@tanilo.io

MIT licensed. TK Collective LLC.
