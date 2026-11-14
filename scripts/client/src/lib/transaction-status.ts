export function transactionStatusLabel(status: string | null | undefined): string {
  if (status === "completed" || status === "approved") return "Successful";
  if (status === "expired") return "Expired";
  if (status === "failed" || status === "rejected" || status === "cancelled" || status === "reversed") return "Declined / Failed";
  return "Pending";
}
