export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  PURCHASE = "purchase",
  REFUND = "refund",
  FEE = "fee",
}

export enum TransactionStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}
