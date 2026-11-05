export function voucherCents(value: string) {
  const negative = value.startsWith("-"), [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}
export function voucherMoney(value: string) {
  const amount = voucherCents(value), positive = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}₱${(positive / 100n).toLocaleString("en-PH")}.${String(positive % 100n).padStart(2, "0")}`;
}
