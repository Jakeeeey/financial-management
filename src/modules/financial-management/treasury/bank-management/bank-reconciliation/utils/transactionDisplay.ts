export function transactionCents(value: string): bigint {
  const negative = value.startsWith("-"), [whole, fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const cents = BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}
export function centsAmount(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export function transactionMoney(value: string, currency: string) {
  const negative = value.startsWith("-"), [whole, fraction = ""] = value.replace(/^[+-]/, "").split(".");
  const parts = new Intl.NumberFormat("en-PH", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(BigInt(whole || "0"));
  return (negative ? "-" : "") + parts.map(part => part.type === "fraction" ? fraction.padEnd(2, "0") : part.value).join("");
}
export function highlightedText(value: string, query: string) {
  const flags = new Array<boolean>(value.length).fill(false), lower = value.toLowerCase();
  for (const token of query.toLowerCase().trim().split(/\s+/).filter(Boolean)) {
    const numeric = token.replace(/[,()₱]/g, "");
    const positions: number[] = [], characters: string[] = [];
    for (let i = 0; i < value.length; i++) if (!/[,()₱]/.test(value[i])) { positions.push(i); characters.push(lower[i]); }
    const amount = /^[+-]?\d+(\.\d+)?$/.test(numeric), hay = amount ? characters.join("") : lower, needle = amount ? numeric : token;
    let index = hay.indexOf(needle);
    while (index >= 0) {
      const first = amount ? positions[index] : index, last = amount ? positions[index + needle.length - 1] : index + needle.length - 1;
      for (let i = first; i <= last; i++) flags[i] = true;
      index = hay.indexOf(needle, index + Math.max(1, needle.length));
    }
  }
  const parts: { text: string; marked: boolean }[] = [];
  for (let i = 0; i < value.length; i++) {
    const last = parts.at(-1);
    if (last && last.marked === flags[i]) last.text += value[i]; else parts.push({ text: value[i], marked: flags[i] });
  }
  return parts;
}
