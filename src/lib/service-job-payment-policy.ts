export function canCreateServiceJobPayment(input: {
  status: string;
  totalMinor: number | null;
  currency: string;
}) {
  return input.status !== "cancelled"
    && Number.isInteger(input.totalMinor)
    && Number(input.totalMinor) > 0
    && /^[A-Z]{3}$/.test(input.currency);
}
