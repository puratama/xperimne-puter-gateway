import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBaseUrl, describeUpstreamError, fetchUpstream } from "../src/lib/upstream";

test("normalizeBaseUrl strips trailing slashes", () => {
  assert.equal(normalizeBaseUrl("https://api.x.com/v1///"), "https://api.x.com/v1");
});

test("normalizeBaseUrl strips accidental endpoint paths", () => {
  assert.equal(normalizeBaseUrl("https://api.x.com/v1/chat/completions"), "https://api.x.com/v1");
  assert.equal(normalizeBaseUrl("https://api.x.com/v1/models"), "https://api.x.com/v1");
});

test("normalizeBaseUrl rejects invalid input", () => {
  assert.throws(() => normalizeBaseUrl(""), /kosong/);
  assert.throws(() => normalizeBaseUrl("api.x.com/v1"), /tidak valid/);
  assert.throws(() => normalizeBaseUrl("ftp://api.x.com"), /http/);
});

test("describeUpstreamError explains timeout and DNS failures", () => {
  const timeoutErr = Object.assign(new Error("aborted"), { name: "TimeoutError" });
  assert.match(describeUpstreamError(timeoutErr, 20_000), /Timeout setelah 20s/);
  assert.match(describeUpstreamError(timeoutErr, 300), /Timeout setelah 300ms/);

  const dnsErr = Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
  assert.match(describeUpstreamError(dnsErr, 20_000), /DNS gagal/);
});

test("describeUpstreamError maps connection-level failures", () => {
  const refused = Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  assert.match(describeUpstreamError(refused, 20_000), /Koneksi ditolak/);

  const tls = Object.assign(new Error("fetch failed"), { cause: { code: "EPROTO" } });
  assert.match(describeUpstreamError(tls, 20_000), /TLS/);
});

test("describeUpstreamError never leaks a bare 'fetch failed'", () => {
  // Node sometimes gives no cause.code at all — the user must still get a hint.
  const bare = new TypeError("fetch failed");
  const msg = describeUpstreamError(bare, 20_000);
  assert.notEqual(msg, "fetch failed");
  assert.match(msg, /base URL/);
});

test("fetchUpstream does NOT retry deterministic misconfiguration", async () => {
  // ECONNREFUSED fails identically on retry — retrying only delays the error.
  const result = await fetchUpstream("http://127.0.0.1:59999/models", { timeoutMs: 3000, retries: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.match(result.error!, /Koneksi ditolak/);
});

test("fetchUpstream returns a timeout result instead of throwing", async () => {
  // Unroutable IP (RFC 5737 TEST-NET-1) → connection hangs until timeout.
  const result = await fetchUpstream("http://192.0.2.1/models", { timeoutMs: 300, retries: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.match(result.error!, /Timeout/);
});

test("fetchUpstream retries transient timeouts", async () => {
  const result = await fetchUpstream("http://192.0.2.1/models", { timeoutMs: 300, retries: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 2);
});
