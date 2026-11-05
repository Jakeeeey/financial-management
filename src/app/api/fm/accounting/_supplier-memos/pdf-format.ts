export const memoPdfMoney = (value: number | string | null | undefined) => value == null
  ? "Needs review"
  : "PHP " + Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
