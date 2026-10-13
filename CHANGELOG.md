# Changelog

## 3.1.0 — 2026-10-13

- Added `check-spend-cap`: calls `POST /v1/verify-facts` with check type `spend_cap` (catalog revision v0.3) and returns the result (state, reason, total, remaining, excess) with the signed receipt. Requires the API to carry the check; until that deploys the tool answers 422 from the live API. Its test runs only when `TANILO_API_BASE` names a server that has the check. Description and result note after review round 2 (2026-10-11): the check does not retrieve budget balances, maintain a running balance or reserve funds; verify the signature against a key set you have authenticated as Tanilo's.

## 3.0.1 — 2026-10-13

- `check-contract-price`: the `agent_id` parameter description names the placeholder the API records from the cutover on 13 October 2026 (UTC), `urn:tanilo:verify-facts:anonymous`. No behaviour change.

## 3.0.0 — unreleased

Renamed from `agentoracle-mcp` to `tanilo-mcp`; the package name, bin name and server name change, so this is a breaking release.

- Added `check-contract-price`: calls `POST https://api.tanilo.io/v1/verify-facts` with check type `contract_price_match` and returns the result (state, reason, evidence) together with the signed receipt (`receipt`, a JWS object) and its `canonical_sha256` and `kid`. The tool description quotes tanilo.io/docs/contract-price-check.
- Removed `research`, `deep-research`, `batch-research` (the routes were retired on 2026-10-04 and answer 410), `resolve` (third-party directory with a stale fallback) and `preview` (tanilo.io has no description of it to quote; it can return in a later version).
- Removed all x402 payment code, the wallet private-key environment variable, the `@x402/*` and `viem` dependencies, the `api-docs` resource (it described retired paid routes), the postinstall banner and `smithery.yaml`.
- `check-health` and `get-manifest` kept; descriptions now say what the two documents contain today.
- All calls go to `https://api.tanilo.io` (was `agentoracle.co`, which serves the same API).
- Added `mcpName` (`io.github.TKCollective/tanilo-mcp`) for the official MCP Registry, and a test suite (`npm test`) that runs the built server over stdio against the live API.

## 2.1.2 — 2026-04-29

Last release under the name `agentoracle-mcp`. See the git history.
