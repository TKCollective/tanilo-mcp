// check-spend-cap needs a server that has the spend_cap check type. The live API
// will not until the API branch is deployed, so this test runs only when
// TANILO_API_BASE points at such a server (for example a local boot of the API
// branch); otherwise it is skipped with a message. The tool-set test always runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = process.env.SERVER_PATH || path.join(HERE, "..", "dist", "index.js");
const API = process.env.TANILO_API_BASE;

async function connect() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: "pipe", env: { ...process.env } });
  const client = new Client({ name: "tanilo-mcp-test", version: "0" });
  await client.connect(transport);
  return client;
}

const OFFER = { unit_price: "12.50", currency: "USD", quantity: "3", offered_at: "2026-10-10T12:00:00Z" };
const CAP = { cap_id: "api-budget-2026-10", amount: "100.00", currency: "USD", scope: "per_period", already_spent: "70.00", period: { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" } };

test("tool set: check-spend-cap is present with the docs wording", async () => {
  const client = await connect();
  try {
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === "check-spend-cap");
    assert.ok(t, tools.map((x) => x.name).join(", "));
    assert.match(t.description, /signs the result when signing succeeds/);
    assert.match(t.description, /does not retrieve budget balances, maintain a running balance or reserve funds/);
    assert.match(t.description, /a key set you have authenticated as Tanilo's/);
    assert.match(t.description, /does not establish that the supplied cap is authentic, approved or current, or that the purchase is authorized/);
    assert.ok(t.inputSchema.properties.offer && t.inputSchema.properties.cap);
  } finally { await client.close(); }
});

test("check-spend-cap: 37.50 against 30.00 remaining is contradicted by 7.50; exactly at cap is verified", { skip: API ? false : "set TANILO_API_BASE to a server that has spend_cap" }, async () => {
  const client = await connect();
  try {
    const over = await client.callTool({ name: "check-spend-cap", arguments: { offer: OFFER, cap: CAP } });
    assert.equal(over.isError, undefined, over.content?.[0]?.text);
    const o = JSON.parse(over.content[0].text);
    assert.equal(o.state, "contradicted"); assert.equal(o.reason, "cap_exceeded"); assert.equal(o.verdict, "halt");
    assert.equal(o.offer_total, "37.50"); assert.equal(o.remaining, "30.00"); assert.equal(o.excess, "7.50");
    assert.match(o.canonical_sha256, /^sha256-[0-9a-f]{64}$/);
    assert.ok(o.receipt && typeof o.receipt.payload === "string");
    const at = await client.callTool({ name: "check-spend-cap", arguments: { offer: OFFER, cap: { ...CAP, already_spent: "62.50" } } });
    const a = JSON.parse(at.content[0].text);
    assert.equal(a.state, "verified"); assert.equal(a.verdict, "act"); assert.equal(a.excess, null);
    const eur = await client.callTool({ name: "check-spend-cap", arguments: { offer: { ...OFFER, currency: "EUR" }, cap: CAP } });
    assert.equal(JSON.parse(eur.content[0].text).reason, "currency_mismatch");
  } finally { await client.close(); }
});
