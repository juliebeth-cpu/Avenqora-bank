// Customer banking portal API helper
const BASE = "/api";

function getToken() {
  return localStorage.getItem("danzy_banking_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.code === "ACCOUNT_SUSPENDED") {
      localStorage.removeItem("danzy_banking_token");
      localStorage.removeItem("danzy_banking_customer");
      window.dispatchEvent(new Event("avenqora:customer-suspended"));
    }
    throw Object.assign(new Error(err.error ?? "Request failed"),
      status: res.status,
      code: err.code,
      data: err,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestWithToken<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const bankingRegister = (body: object) =>
  request<{ message: string; onboardingToken: string; customer: any; nextStep: string }>("/customer/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const bankingCompleteOnboardingProfile = (token: string, body: object) =>
  requestWithToken<any>(token, "/customer/auth/onboarding/profile", { method: "POST", body: JSON.stringify(body) });

export const bankingLogin = (body: object) =>
  request<{ token: string; customer: any }>("/customer/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const bankingVerifyEmail = (token: string) =>
  request<{ message: string }>("/customer/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const bankingForgotPassword = (websiteUid: string, email: string) =>
  request<{ message: string }>("/customer/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ websiteUid, email }),
  });

export const bankingResetPassword = (token: string, newPassword: string) =>
  request<{ message: string }>("/customer/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });

export const bankingMe = () => request<any>("/customer/auth/me");

export const bankingLogout = () =>
  request<{ message: string }>("/customer/auth/logout", { method: "POST" });

// ─── Dashboard ────────────────────────────────────────────────────────────────
function bankingMonotonicNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export const bankingDashboard = async () => {
  const requestStartedAt = bankingMonotonicNow();
  const dashboard = await request<any>("/customer/dashboard");
  const responseReceivedAt = bankingMonotonicNow();
  return {
    ...dashboard,
    serverTimeMonotonicAnchorMs: (requestStartedAt + responseReceivedAt) / 2,
  };
};

export function estimateBankingServerNow(dashboard: any, monotonicNow = bankingMonotonicNow()): number {
  const serverTimeMs = Date.parse(dashboard?.serverTime ?? "");
  const anchorMs = Number(dashboard?.serverTimeMonotonicAnchorMs);
  if (!Number.isFinite(serverTimeMs) || !Number.isFinite(anchorMs)) return Date.now();
  return serverTimeMs + monotonicNow - anchorMs;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
export const bankingListAccounts = () => request<any[]>("/customer/accounts");

export interface TransactionListOptions {
  accountId?: number;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function bankingListTransactions(): Promise<any[]>;
export function bankingListTransactions(options: TransactionListOptions): Promise<any[]>;
export function bankingListTransactions(options: TransactionListOptions = {}) {
  const params = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return request<any[]>(`/customer/transactions${query ? `?${query}` : ""}`);
}

export const bankingGetTransaction = (id: number | string) =>
  request<any>(`/customer/transactions/${encodeURIComponent(String(id))}`);

export const bankingGenerateTransactionReceipt = (id: number | string) =>
  request<{ id: number; receiptNumber: string; transactionKind: string; sourceId: number; status: string; rejectionReason: string | null }>(
    `/customer/transactions/${encodeURIComponent(String(id))}/receipt`,
    { method: "POST" },
  );

export interface StatementQuery {
  accountId: number;
  from?: string;
  to?: string;
}

export const bankingGetStatement = (query: StatementQuery) => {
  const params = new URLSearchParams({ accountId: String(query.accountId) });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return request<any>(`/customer/statements?${params.toString()}`);
};

export const bankingDownloadStatementCsv = async (query: StatementQuery): Promise<Blob> => {
  const params = new URLSearchParams({ accountId: String(query.accountId), format: "csv" });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const res = await fetch(`${BASE}/customer/statements?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Could not download statement"), {
      status: res.status,
      code: err.code,
      data: err,
    });
  }
  return res.blob();
};

// ─── Deposits ─────────────────────────────────────────────────────────────────
export const bankingListDeposits = () => request<any[]>("/customer/deposits");
export const bankingListDepositMethods = () => request<any[]>("/customer/deposit-methods");
export const bankingListDepositBankAccounts = () => request<any[]>("/customer/deposit-bank-accounts");
export const bankingCreateDeposit = (body: object) =>
  request<any>("/customer/deposits", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const bankingAttachReceipt = (id: number, receiptUrl: string) =>
  request<any>(`/customer/deposits/${id}/receipt`, {
    method: "POST",
    body: JSON.stringify({ receiptUrl }),
  });

// ─── Withdrawals ──────────────────────────────────────────────────────────────
export const bankingListWithdrawals = () =>
  request<any[]>("/customer/withdrawals");
export const bankingCreateWithdrawal = (body: object) =>
  request<any>("/customer/withdrawals", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ─── Transfers ────────────────────────────────────────────────────────────────
export const bankingListTransfers = () => request<any[]>("/customer/transfers");
export const bankingCreateTransfer = (body: object) =>
  request<any>("/customer/transfers", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const bankingGetSupportWidgetConfig = () => request<{ enabled: boolean; smartsuppKey: string }>("/banking/public/support-widget");

// ─── Regional online banking actions ─────────────────────────────────────────
export const bankingListCustomerActions = () => request<any[]>("/customer/banking-actions");
export const bankingCreateCustomerAction = (body: object) =>
  request<any>("/customer/banking-actions", { method: "POST", body: JSON.stringify(body) });
export const bankingGetCreditScore = () => request<any>("/customer/credit-score");
export const bankingListSupportMessages = () => request<any[]>("/customer/banking/messages");
export const bankingSendSupportMessage = (body: object) =>
  request<any>("/customer/banking/messages", { method: "POST", body: JSON.stringify(body) });

// ─── KYC ──────────────────────────────────────────────────────────────────────
export const bankingGetKyc = () =>
  request<any>("/customer/kyc").catch(() => null);
export const bankingSubmitKyc = (body: object) =>
  request<any>("/customer/kyc", { method: "POST", body: JSON.stringify(body) });

export const bankingSubmitKycWithToken = (token: string, body: object) =>
  requestWithToken<any>(token, "/customer/kyc", { method: "POST", body: JSON.stringify(body) });

export const bankingRequestKycUpload = (token: string, submissionId: number, slot: "front" | "back" | "selfie", file: File) =>
  requestWithToken<{ uploadURL: string; objectPath: string }>(token, "/customer/kyc/upload-url", {
    method: "POST",
    body: JSON.stringify({ submissionId, slot, name: file.name, size: file.size, contentType: file.type }),
  });

export const bankingAttachKycFile = (token: string, submissionId: number, slot: "front" | "back" | "selfie", objectPath: string) =>
  requestWithToken<any>(token, `/customer/kyc/${submissionId}/file`, {
    method: "POST",
    body: JSON.stringify({ slot, objectPath }),
  });

export async function bankingUploadKycFile(uploadURL: string, file: File): Promise<void> {
  const response = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!response.ok) throw new Error("KYC document upload failed");
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export const bankingListCards = () => request<any[]>("/customer/cards");
export const bankingSubmitCard = (body: object) =>
  request<any>("/customer/cards", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ─── Notifications ────────────────────────────────────────────────────────────
export const bankingListNotifications = () =>
  request<any[]>("/customer/notifications");
export const bankingMarkNotificationRead = (id: number) =>
  request<void>(`/customer/notifications/${id}/read`, { method: "PATCH" });
export const bankingMarkAllRead = () =>
  request<void>("/customer/notifications/read-all", { method: "PATCH" });

// ─── Receipts ─────────────────────────────────────────────────────────────────
export const bankingListReceipts = () => request<any[]>("/customer/receipts");
export const bankingGetReceipt = (id: number) => request<any>(`/customer/receipts/${id}`);

// ─── Profile ──────────────────────────────────────────────────────────────────
export const bankingUpdateProfile = (body: object) =>
  request<any>("/customer/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const bankingUpdatePhoto = (profilePhotoUrl: string) =>
  request<any>("/customer/profile/photo", {
    method: "POST",
    body: JSON.stringify({ profilePhotoUrl }),
  });
export const bankingChangePassword = (
  currentPassword: string,
  newPassword: string,
) =>
  request<any>("/customer/security/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
export const bankingSetTransactionPin = (currentPassword: string, transactionPin: string, confirmTransactionPin: string) =>
  request<any>("/customer/security/transaction-pin", {
    method: "POST",
    body: JSON.stringify({ currentPassword, transactionPin, confirmTransactionPin }),
  });

// ─── Beneficiaries ────────────────────────────────────────────────────────────
export const bankingListBeneficiaries = () => request<any[]>("/customer/beneficiaries");
export const bankingCreateBeneficiary = (body: object) =>
  request<any>("/customer/beneficiaries", { method: "POST", body: JSON.stringify(body) });
export const bankingUpdateBeneficiary = (id: number, body: object) =>
  request<any>(`/customer/beneficiaries/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const bankingDeleteBeneficiary = (id: number) =>
  request<void>(`/customer/beneficiaries/${id}`, { method: "DELETE" });

// ─── Loans ────────────────────────────────────────────────────────────────────
export const bankingListLoans = () => request<any[]>("/customer/loans");
export const bankingApplyLoan = (body: object) =>
  request<any>("/customer/loans", { method: "POST", body: JSON.stringify(body) });

// ─── Generic Template Engine (customer side) ───────────────────────────────────
export const genericSummary = () => request<any>("/customer/generic/summary");
export const genericListRecords = () => request<any[]>("/customer/generic/records");
export const genericCreateRecord = (body: object) =>
  request<any>("/customer/generic/records", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const genericPaymentSettings = () => request<any>("/customer/generic/payment-settings");
export const genericListPayments = () => request<any[]>("/customer/generic/payments");
export const genericSubmitPayment = (recordId: number, body: object) =>
  request<any>(`/customer/generic/records/${recordId}/payment`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const genericRequestEvidenceUpload = (recordId: number, file: File) =>
  request<{ uploadURL: string; objectPath: string }>("/customer/uploads/receipt-url", {
    method: "POST",
    body: JSON.stringify({ recordId, contentType: file.type || "application/octet-stream" }),
  });
