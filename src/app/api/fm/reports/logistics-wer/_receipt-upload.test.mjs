import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const filename = path.resolve(file);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (name in overrides) return overrides[name];
    if (name.startsWith("@/") || name.startsWith(".")) return load((name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(filename), name)) + ".ts", overrides);
    return require(name);
  }, exports);
  return exports;
}

const route = "src/app/api/fm/reports/logistics-wer/[dispatchPlanId]/payables/receipts/route.ts";
const overrides = {
  "../../../_payables": { requireSessionUserId: async () => 1, getPlanBaseline: async () => ({ status: "For Clearance" }) },
  "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
};
async function upload(file) {
  const form = new FormData(); form.set("file", file);
  return load(route, overrides).POST({ formData: async () => form }, { params: Promise.resolve({ dispatchPlanId: "1" }) });
}
test("invalid uploads are rejected before reaching storage; upstream 413 is preserved", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("Too large", { status: 413 }); };
  try {
    const oversized = await upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "scan.pdf", { type: "application/pdf" }));
    assert.equal(oversized.status, 413);
    assert.equal((await upload(new File(["x"], "scan.exe"))).status, 415);
    assert.equal((await upload(new File([], "scan.pdf"))).status, 400);
    assert.equal(calls, 0);
    const upstream = await upload(new File(["pdf"], "scan.pdf", { type: "application/pdf" }));
    assert.equal(upstream.status, 413);
    assert.match((await upstream.json()).message, /5 MB/);
    assert.equal(calls, 1);
    globalThis.fetch = async () => Response.json({ data: { id: "receipt-1" } });
    assert.equal((await upload(new File(["png"], "scan.png", { type: "image/png" }))).status, 201);
  } finally { globalThis.fetch = original; }
});


test("client upload timeout and non-JSON 413 return actionable errors", async () => {
  const policy = load("src/modules/financial-management/reports/logistics-wer/utils/receipt-upload.ts");
  const api = load("src/modules/financial-management/reports/logistics-wer/services/logisticsWerApi.ts", {
    "../utils/receipt-upload": { ...policy, RECEIPT_UPLOAD_TIMEOUT_MS: 5 },
  });
  const original = globalThis.fetch;
  const file = new File(["pdf"], "scan.pdf", { type: "application/pdf" });
  try {
    globalThis.fetch = async () => new Response("Too large", { status: 413 });
    await assert.rejects(api.uploadPayableReceipt(1, file), /5 MB limit/);
    globalThis.fetch = async (_, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    await assert.rejects(api.uploadPayableReceipt(1, file), /Upload timed out/);
    globalThis.fetch = async () => { throw new Error("Network unavailable"); };
    await assert.rejects(api.uploadPayableReceipt(1, file), /Network unavailable/);
  } finally { globalThis.fetch = original; }
});
