export function ewtQuarterReminder(quarter: string) {
  if (!/^[1-9]\d{3}-Q[1-4]$/.test(quarter)) return null;
  const year = Number(quarter.slice(0, 4)), number = Number(quarter.slice(-1));
  if (year > 9998) return null;
  // Match the prototype's calendar dates without browser timezone shifts.
  return {
    label: `Q${number} ${year}`,
    certificateDate: new Date(Date.UTC(year, number * 3, 20)).toISOString().slice(0, 10),
    remittanceDate: new Date(Date.UTC(year, number * 3 + 1, 0)).toISOString().slice(0, 10),
  };
}
