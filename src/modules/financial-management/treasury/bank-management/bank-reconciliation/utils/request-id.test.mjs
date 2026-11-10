import assert from "node:assert/strict";
import test from "node:test";
import { bankReconciliationRequestId } from "./request-id.ts";

function withCrypto(value, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value });
  try { run(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
}

test("uses the native UUID generator when available", () => {
  const expected = "123e4567-e89b-42d3-a456-426614174000";
  withCrypto({ randomUUID: () => expected }, () => {
    assert.equal(bankReconciliationRequestId(), expected);
  });
});

test("generates an RFC 4122 UUID v4 when randomUUID is unavailable", () => {
  const mockCrypto = {
    getRandomValues(array) {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      bytes.forEach((_, index) => { bytes[index] = index; });
      return array;
    },
  };

  withCrypto(mockCrypto, () => {
    assert.equal(bankReconciliationRequestId(), "00010203-0405-4607-8809-0a0b0c0d0e0f");
  });
});

test("fails closed when no secure generator is available", () => {
  withCrypto({}, () => {
    assert.throws(() => bankReconciliationRequestId(), /secure request identifier/);
  });
});
