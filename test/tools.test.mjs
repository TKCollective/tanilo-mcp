// Runs the built server over stdio with the MCP SDK client and checks the tool set and
// the contract price check against the live API (free beta route; one request).
// SERVER_PATH may point at another build (used to show this test fails on main).
// If a Python with tanilo-receipt-verify is on PATH (or TANILO_PYTHON is set), the
// receipt's signature is also verified offline against the published key set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = process.env.SERVER_PATH || path.join(HERE, "..", "dist", "index.js");

// The example from https://tanilo.io/docs/contract-price-check: offer USD 2.00 per call
// against a supplied term of USD 1.00 per call. Expected: contradicted, verdict halt.
const OFFER = {
  unit_price: "2.00", currency: "USD", unit: "call", quantity: "1",
  seller: "seller.example", sku: "api.weather.v1", offered_at: "2026-10-01T12:00:00Z",
};
const TERMS = [{
  agreement_id: "MSA-2026-014", version: "1", seller: "seller.example",
  product_scope: { skus: ["api.weather.v1"] }, currency: "USD", unit: "call",
  price_per_unit: "1.00", effective_from: "2026-01-01T00:00:00Z",
}];

async function connect() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: "pipe" });
  const client = new Client({ name: "tanilo-mcp-test", version: "0" });
  await client.connect(transport);
  return client;
}

test("tool set: check-contract-price present; retired research and payment tools absent", async () => {
  const client = await connect();
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.ok(names.includes("check-contract-price"), `tools: ${names.join(", ")}`);
    for (const gone of ["research", "deep-research", "batch-research", "resolve", "preview"]) {
      assert.ok(!names.includes(gone), `retired tool still present: ${gone}`);
    }
    const cpc = tools.find((t) => t.name === "check-contract-price");
    assert.match(cpc.description, /signs the result when signing succeeds/);
    assert.match(cpc.description, /It does not show that the supplied terms were genuine/);
    assert.ok(cpc.inputSchema.properties.offer && cpc.inputSchema.properties.terms);
  } finally {
    await client.close();
  }
});

test("check-contract-price: docs example gives contradicted / halt with a signed receipt", async () => {
  const client = await connect();
  try {
    const res = await client.callTool({ name: "check-contract-price", arguments: { offer: OFFER, terms: TERMS } });
    assert.equal(res.isError, undefined, res.content?.[0]?.text);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.state, "contradicted");
    assert.equal(out.verdict, "halt");
    assert.equal(out.reason, "price_mismatch");
    assert.equal(out.check_mode, "deterministic");
    assert.equal(out.evidence.offer_is, "above_term_price");
    assert.equal(out.evidence.difference_per_unit, "1.00");
    assert.equal(out.evidence.terms_source, "caller_supplied");
    assert.match(out.canonical_sha256, /^sha256-[0-9a-f]{64}$/);
    assert.equal(out.kid, "tanilo-2026-10-ed25519-7d885da9");
    assert.ok(out.receipt && typeof out.receipt.payload === "string" && Array.isArray(out.receipt.signatures), "receipt is a JWS object");

    // Offline signature check with tanilo-receipt-verify, when a Python with it is available.
    const py = process.env.TANILO_PYTHON || "python3";
    const probe = spawnSync(py, ["-c", "import tanilo_receipt_verify"], { encoding: "utf8" });
    if (probe.status !== 0) {
      console.log("  (signature check skipped: tanilo-receipt-verify not importable with " + py + ")");
      return;
    }
    const jwks = await (await fetch(out.jwks_url)).json();
    const script = [
      "import json,sys",
      "from tanilo_receipt_verify import verify",
      "d=json.load(sys.stdin)",
      "r=verify(d['receipt'], jwks_by_issuer={d['jwks_url']: d['jwks']}, jwks_is_complete=True)",
      "print(json.dumps({'status': r.status, 'canonical_sha256': r.canonical_sha256, 'signers': [s['kid'] for s in r.signers]}))",
    ].join("\n");
    const v = spawnSync(py, ["-I", "-c", script], { input: JSON.stringify({ receipt: out.receipt, jwks_url: out.jwks_url, jwks }), encoding: "utf8" });
    assert.equal(v.status, 0, v.stderr);
    const verdict = JSON.parse(v.stdout);
    assert.equal(verdict.status, "valid");
    assert.equal(verdict.canonical_sha256, out.canonical_sha256);
    assert.deepEqual(verdict.signers, [out.kid]);
    console.log("  signature: " + verdict.status + " " + verdict.canonical_sha256 + " " + verdict.signers.join(","));
  } finally {
    await client.close();
  }
});

test("check-contract-price: no terms gives indeterminate / no_applicable_term", async () => {
  const client = await connect();
  try {
    const res = await client.callTool({ name: "check-contract-price", arguments: { offer: OFFER, terms: [] } });
    assert.equal(res.isError, undefined, res.content?.[0]?.text);
    const out = JSON.parse(res.content[0].text);
    assert.equal(out.state, "indeterminate");
    assert.equal(out.reason, "no_applicable_term");
    assert.equal(out.verdict, "halt");
  } finally {
    await client.close();
  }
});
