// Manual API helpers for Website Admin Portal and Public routes.
const BASE = "/api";

// ── Portal (Website Admin) token ──────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("danzy_portal_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  const region = localStorage.getItem("danzy_banking_admin_region") ?? "ALL";
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json", "X-Banking-Region": region }
    : { "Content-Type": "application/json", "X-Banking-Region": region };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status, code: err.code, data: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Master Admin token ────────────────────────────────────────────────────────
function getMasterToken() {
  return localStorage.getItem("danzy_token");
}

function masterAuthHeaders(): HeadersInit {
  const t = getMasterToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function masterRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...masterAuthHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status, code: err.code, data: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const portalLogin = (websiteUid: string, identifier: string, password: string) =>
  request<{ token: string; admin: any } | { requiresTwoFactor: true; preAuthToken: string }>("/website/auth/login", {
    method: "POST", body: JSON.stringify({ websiteUid, identifier, password }),
  });

export const portalComplete2FA = (preAuthToken: string, code: string) =>
  request<{ token: string; admin: any }>("/website/auth/login/2fa", {
    method: "POST", body: JSON.stringify({ preAuthToken, code }),
  });

export const portalMe = () => request<any>("/website/auth/me");
export const portalTrackingTheme = () => request<any>("/website/tracking-theme");
export const portalUpdateTrackingTheme = (theme: object) =>
  request<any>("/website/tracking-theme", { method: "PUT", body: JSON.stringify(theme) });

export const portalEmailSettings = () => request<any>("/website/email-settings");
export const portalUpdateEmailIdentity = (identity: "main_system" | "customer_support", body: { address: string; senderName: string }) =>
  request<any>(`/website/email-settings/${identity}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalVerifyEmailIdentity = (identity: "main_system" | "customer_support") =>
  request<any>(`/website/email-settings/${identity}/verify`, { method: "POST" });
export const portalUpdateNotificationTemplates = (templates: object) =>
  request<any>("/website/email-settings/templates", { method: "PATCH", body: JSON.stringify(templates) });

export const portalChangePassword = (body: { currentPassword: string; newPassword: string }) =>
  request<{ success: boolean; message: string }>("/website/auth/change-password", {
    method: "POST", body: JSON.stringify(body),
  });

export const portalForgotPassword = (websiteUid: string, email: string) =>
  fetch(`${BASE}/website/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUid, email }),
  }).then(r => r.json());

export const portalResetPassword = (websiteUid: string, email: string, pin: string, newPassword: string) =>
  fetch(`${BASE}/website/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUid, email, pin, newPassword }),
  }).then(r => r.json());

// ─── 2FA / TOTP ───────────────────────────────────────────────────────────────
export const portal2FAStatus = () =>
  request<{ totpEnabled: boolean }>("/website/auth/2fa/status");

export const portal2FASetup = () =>
  request<{ secret: string; uri: string; issuer: string; username: string; message: string }>("/website/auth/2fa/setup", {
    method: "POST",
  });

export const portal2FAVerify = (code: string) =>
  request<{ success: boolean; message: string }>("/website/auth/2fa/verify", {
    method: "POST", body: JSON.stringify({ code }),
  });

export const portal2FADisable = (password: string, code: string) =>
  request<{ success: boolean; message: string }>("/website/auth/2fa/disable", {
    method: "POST", body: JSON.stringify({ password, code }),
  });

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const portalDashboard = () => request<any>("/website/dashboard");

// ─── Subscription ─────────────────────────────────────────────────────────────
export const portalSubscription = () => request<any>("/website/subscription");
export const portalPaySubmit = (body: object) =>
  request<any>("/website/subscription/pay", { method: "POST", body: JSON.stringify(body) });

// ─── Live Chat Widget ─────────────────────────────────────────────────────────
export type LiveChatStatus = "pending" | "active" | "failed" | "disabled" | null;
export interface LiveChatWidget {
  liveChatCode: string | null;
  liveChatEnabled: boolean;
  liveChatStatus: LiveChatStatus;
}

export const portalGetLiveChatWidget = () =>
  request<LiveChatWidget>("/website/live-chat-widget");

export const portalUpdateLiveChatWidget = (body: {
  liveChatCode?: string;
  liveChatEnabled?: boolean;
}) =>
  request<LiveChatWidget>("/website/live-chat-widget", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const portalGetLiveChatAudit = () =>
  request<any[]>("/website/live-chat-audit");

// ─── Support Channels ─────────────────────────────────────────────────────────
export const portalListChannels = () => request<any[]>("/website/support-channels");
export const portalCreateChannel = (body: object) =>
  request<any>("/website/support-channels", { method: "POST", body: JSON.stringify(body) });
export const portalUpdateChannel = (id: number, body: object) =>
  request<any>(`/website/support-channels/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteChannel = (id: number) =>
  request<void>(`/website/support-channels/${id}`, { method: "DELETE" });

// ─── Shipments ────────────────────────────────────────────────────────────────
export const portalListShipments = (params: Record<string, string | number | undefined> = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "") as Array<[string, string]>,
  ).toString();
  return request<{ items: any[]; pagination: { page: number; pageSize: number; total: number; pageCount: number } }>(
    `/website/shipments${query ? `?${query}` : ""}`,
  );
};
export const portalGetShipment = (id: number) => request<any>(`/website/shipments/${id}`);
export const portalEnsureShipmentReceiptVerification = (id: number) =>
  request<{ receiptNumber: string; verificationPath: string; verificationUrl: string }>(
    `/website/shipments/${id}/receipt-verification`,
    { method: "POST" },
  );
export const portalCreateShipment = (body: object) =>
  request<any>("/website/shipments", { method: "POST", body: JSON.stringify(body) });
export const portalGetShipmentPhotoUploadURL = (contentType: string, fileSize: number) =>
  request<{ uploadURL: string; objectPath: string }>("/website/shipments/photo-upload-url", {
    method: "POST",
    body: JSON.stringify({ contentType, fileSize }),
  });
export const portalUpdateShipment = (id: number, body: object) =>
  request<any>(`/website/shipments/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteShipment = (id: number) =>
  request<void>(`/website/shipments/${id}`, { method: "DELETE" });
export const portalCreateShipmentStop = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/stops`, { method: "POST", body: JSON.stringify(body) });
export const portalUpdateShipmentStop = (shipmentId: number, stopId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/stops/${stopId}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteShipmentStop = (shipmentId: number, stopId: number) =>
  request<void>(`/website/shipments/${shipmentId}/stops/${stopId}`, { method: "DELETE" });
export const portalListJourneyLocations = (query = "", locationType = "") => {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (locationType) params.set("locationType", locationType);
  const suffix = params.toString();
  return request<any[]>(`/website/journey-locations${suffix ? `?${suffix}` : ""}`);
};
export const portalCreateJourneyLocation = (body: object) =>
  request<any>("/website/journey-locations", { method: "POST", body: JSON.stringify(body) });
export const portalUpdateJourneyLocation = (id: number, body: object) =>
  request<any>(`/website/journey-locations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteJourneyLocation = (id: number) =>
  request<void>(`/website/journey-locations/${id}`, { method: "DELETE" });

// ─── Flights ──────────────────────────────────────────────────────────────────
export const portalListFlights = () => request<any[]>("/website/flights");
export const portalCreateFlight = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/flight`, { method: "POST", body: JSON.stringify(body) });
export const portalUpdateFlight = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/flight`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteFlight = (id: number) =>
  request<void>(`/website/flights/${id}`, { method: "DELETE" });
export const portalFlightOverride = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/flight/override`, { method: "POST", body: JSON.stringify(body) });

// ─── Customers ────────────────────────────────────────────────────────────────
export const portalListCustomers = () => request<any[]>("/website/customers");
export const portalGetCustomer = (id: number) => request<any>(`/website/customers/${id}`);
export const portalUpdateCustomer = (id: number, body: object) =>
  request<any>(`/website/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalUpdateCustomerProfile = (id: number, body: object) =>
  request<any>(`/website/customers/${id}/profile`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Accounts ─────────────────────────────────────────────────────────────────
export const portalListAccounts = () => request<any[]>("/website/accounts");
export const portalUpdateAccount = (id: number, body: object) =>
  request<any>(`/website/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── KYC ──────────────────────────────────────────────────────────────────────
export const portalListKyc = () => request<any[]>("/website/kyc");
export const portalUpdateKyc = (id: number, body: object) =>
  request<any>(`/website/kyc/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Deposits ─────────────────────────────────────────────────────────────────
export const portalListDeposits = () => request<any[]>("/website/deposits");
export const portalUpdateDeposit = (id: number, body: object) =>
  request<any>(`/website/deposits/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Withdrawals ──────────────────────────────────────────────────────────────
export const portalListWithdrawals = () => request<any[]>("/website/withdrawals");
export const portalUpdateWithdrawal = (id: number, body: object) =>
  request<any>(`/website/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Transfers ────────────────────────────────────────────────────────────────
export const portalListTransfers = () => request<any[]>("/website/transfers");
export const portalUpdateTransfer = (id: number, body: object) =>
  request<any>(`/website/transfers/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Cards ────────────────────────────────────────────────────────────────────
export const portalListCards = () => request<any[]>("/website/cards");
export const portalUpdateCard = (id: number, body: object) =>
  request<any>(`/website/cards/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteCard = (id: number) =>
  request<{ success: boolean; id: number }>(`/website/cards/${id}`, { method: "DELETE" });

// ─── Banking Settings ─────────────────────────────────────────────────────────
export const portalBankingSettings = () => request<any>("/website/banking-settings");
export const portalUpdateBankingSettings = (body: object) =>
  request<any>("/website/banking-settings", { method: "PATCH", body: JSON.stringify(body) });
export const portalGetBankingSupportWidgetSettings = () =>
  request<{ supportWidgetEnabled: boolean; smartsuppKey: string }>("/banking/admin/settings");
export const portalUpdateBankingSupportWidgetSettings = (body: { supportWidgetEnabled: boolean; smartsuppKey: string }) =>
  request<any>("/banking/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
export const portalListDepositBankAccounts = () => request<any[]>("/website/deposit-bank-accounts");
export const portalCreateDepositBankAccount = (body: object) =>
  request<any>("/website/deposit-bank-accounts", { method: "POST", body: JSON.stringify(body) });
export const portalUpdateDepositBankAccount = (id: number, body: object) =>
  request<any>(`/website/deposit-bank-accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalGetCustomerLocalization = () => request<any>("/website/customer-localization");
export const portalUpdateCustomerLocalization = (body: object) =>
  request<any>("/website/customer-localization", { method: "PATCH", body: JSON.stringify(body) });

// ─── Shipment Billing ─────────────────────────────────────────────────────────
export const portalListShipmentBills = () => request<any[]>("/website/shipment-billing");
export const portalUpdateShipmentBill = (id: number, body: object) =>
  request<any>(`/website/shipment-billing/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Generic Records ──────────────────────────────────────────────────────────
export const portalListGenericRecords = () => request<any[]>("/website/generic-records");
export const portalCreateGenericRecord = (body: object) =>
  request<any>("/website/generic-records", { method: "POST", body: JSON.stringify(body) });
export const portalUpdateGenericRecord = (id: number, body: object) =>
  request<any>(`/website/generic-records/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteGenericRecord = (id: number) =>
  request<void>(`/website/generic-records/${id}`, { method: "DELETE" });

// ─── Payment Settings ─────────────────────────────────────────────────────────
export const portalPaymentSettings = () => request<any>("/website/payment-settings");
export const portalUpdatePaymentSettings = (body: object) =>
  request<any>("/website/payment-settings", { method: "PATCH", body: JSON.stringify(body) });

// ─── Custom Statuses ──────────────────────────────────────────────────────────
export const portalListCustomStatuses = () => request<any[]>("/website/custom-statuses");
export const portalCreateCustomStatus = (label: string) =>
  request<any>("/website/custom-statuses", { method: "POST", body: JSON.stringify({ label }) });
export const portalUpdateCustomStatus = (id: number, body: object) =>
  request<any>(`/website/custom-statuses/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteCustomStatus = (id: number | string) =>
  request<void>(`/website/custom-statuses/${id}`, { method: "DELETE" });

// ─── Investment Plans ─────────────────────────────────────────────────────────
export const portalListInvestmentPlans = () => request<any[]>("/website/investment-plans");
export const portalCreateInvestmentPlan = (body: object) =>
  request<any>("/website/investment-plans", { method: "POST", body: JSON.stringify(body) });
export const portalUpdateInvestmentPlan = (id: number, body: object) =>
  request<any>(`/website/investment-plans/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteInvestmentPlan = (id: number) =>
  request<void>(`/website/investment-plans/${id}`, { method: "DELETE" });

// ─── Promotions ───────────────────────────────────────────────────────────────
export const portalListPromotionalVideos = () => request<any[]>("/website/promotional-videos");
export const portalCreatePromotionalVideo = (body: object) =>
  request<any>("/website/promotional-videos", { method: "POST", body: JSON.stringify(body) });
export const portalDeletePromotionalVideo = (id: number) =>
  request<void>(`/website/promotional-videos/${id}`, { method: "DELETE" });

// ─── Loans ────────────────────────────────────────────────────────────────────
export const portalListLoans = () => request<any[]>("/website/loans");
export const portalUpdateLoan = (id: number, body: object) =>
  request<any>(`/website/loans/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ─── Receipts ─────────────────────────────────────────────────────────────────
export const portalListReceipts = () => request<any[]>("/website/receipts");

// ─── Analytics ────────────────────────────────────────────────────────────────
export const portalAnalytics = () => request<any>("/website/analytics");

// ─── Deposit Wallets ──────────────────────────────────────────────────────────
export const portalListDepositWallets = () => request<any[]>("/website/deposit-wallets");
export const portalCreateDepositWallet = (body: object) =>
  request<any>("/website/deposit-wallets", { method: "POST", body: JSON.stringify(body) });
export const portalDeleteDepositWallet = (id: number) =>
  request<void>(`/website/deposit-wallets/${id}`, { method: "DELETE" });

// ─── Public info ──────────────────────────────────────────────────────────────
export const publicInfo = (websiteUid: string) =>
  fetch(`${BASE}/public/websites/${websiteUid}/info`).then(async r => {
    if (!r.ok) throw new Error("Not found");
    return r.json();
  });

// ─── Global Payment Tracking Network ─────────────────────────────────────────
// This endpoint is intentionally separate from the shipment/journey tracker.
export const publicGlobalPaymentTracking = (trackingNumber: string) =>
  fetch(`${BASE}/public/global-payment-tracking/${encodeURIComponent(trackingNumber)}`, {
    headers: { Accept: "application/json" },
  }).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw Object.assign(new Error(data.error ?? "Payment tracking record not found"), {
        status: r.status,
        code: data.code,
      });
    }
    return data;
  });

// ─── Accounts extra actions ────────────────────────────────────────────────────
export const portalGetAccountTransactions = (id: number) => request<any[]>(`/website/accounts/${id}/transactions`);
export const portalFundAccount = (id: number, amount: number, description?: string) =>
  request<any>(`/website/accounts/${id}/fund`, { method: "POST", body: JSON.stringify({ amount, description }) });
export const portalDebitAccount = (id: number, amount: number, description?: string) =>
  request<any>(`/website/accounts/${id}/debit`, { method: "POST", body: JSON.stringify({ amount, description }) });
export const portalAdminFundAccount = (id: number, body: object) =>
  request<any>(`/website/accounts/${id}/fund`, { method: "POST", body: JSON.stringify(body) });
export const portalAdminDebitAccount = (id: number, body: object) =>
  request<any>(`/website/accounts/${id}/debit`, { method: "POST", body: JSON.stringify(body) });
export const portalEditBalance = (id: number, currentBalance?: number | string, ledgerBalance?: number | string) =>
  request<any>(`/website/accounts/${id}/balance`, { method: "PATCH", body: JSON.stringify({ currentBalance, ledgerBalance }) });
export const portalUpdateAccountStatus = (id: number, status: string) =>
  request<any>(`/website/accounts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const portalReviewCard = (id: number, status: "approved" | "declined", declineReason?: string) =>
  request<any>(`/website/cards/${id}`, { method: "PATCH", body: JSON.stringify({ status, declineReason }) });
export const portalGetAnalytics = () => request<any>("/website/analytics");
export const portalGetBankingDashboard = () => request<any>("/website/banking/dashboard");
export const portalGetBankingDashboardForRegion = (region: "ALL" | "USA" | "EUROPE") =>
  request<any>("/website/banking/dashboard", {
    headers: { "X-Banking-Region": region },
  });
export const portalListBankingTransactions = () => request<any[]>("/website/banking/transactions");
export const portalListBankingAuditLogs = () => request<any[]>("/website/banking/audit-logs");

// ─── Master-only helpers (used by portal pages that share master auth) ─────────
export const masterListPlans = () => masterRequest<any[]>("/master/subscription-plans");
export const masterCreatePlan = (body: object) =>
  masterRequest<any>("/master/subscription-plans", { method: "POST", body: JSON.stringify(body) });
export const masterUpdatePlan = (id: number, body: object) =>
  masterRequest<any>(`/master/subscription-plans/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const masterDeletePlan = (id: number) =>
  masterRequest<void>(`/master/subscription-plans/${id}`, { method: "DELETE" });

export const masterListPaymentMethods = () => masterRequest<any[]>("/master/payment-methods");
export const masterListMethods = () => masterRequest<any[]>("/master/payment-methods");
export const masterCreateMethod = (body: object) =>
  masterRequest<any>("/master/payment-methods", { method: "POST", body: JSON.stringify(body) });
export const masterUpdateMethod = (id: number, body: object) =>
  masterRequest<any>(`/master/payment-methods/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const masterDeleteMethod = (id: number) =>
  masterRequest<void>(`/master/payment-methods/${id}`, { method: "DELETE" });

export const masterListAuditLogs = () => masterRequest<any[]>("/master/audit-logs");

export const masterListPayments = () => masterRequest<any[]>("/master/payments");
export const masterReviewPayment = (id: number, body: object) =>
  masterRequest<any>(`/master/payments/${id}/review`, { method: "PATCH", body: JSON.stringify(body) });

export const masterToggleSubscription = (id: number, enabled: boolean) =>
  masterRequest<any>(`/master/websites/${id}/toggle-subscription`, { method: "PATCH", body: JSON.stringify({ enabled }) });

// ─── Portal aliases & additional helpers ──────────────────────────────────────
export const portalGenericRecords = () => request<any[]>("/website/generic/records");
export const portalGenericUpdateRecord = (id: number, status: string) =>
  request<any>(`/website/generic/records/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
export const portalGenericPayments = () => request<any[]>("/website/generic/payments");
export const portalReviewGenericPayment = (id: number, body: object) =>
  request<any>(`/website/generic/payments/${id}/review`, { method: "PATCH", body: JSON.stringify(body) });
export const portalGenericPaymentEvidence = (id: number) =>
  request<{ url: string }>(`/website/generic/payments/${id}/evidence`);

export const portalGetPaymentSettings = () => request<any>("/website/payment-settings");
export const portalGetBankingSettings = () => request<any>("/website/banking-settings");

// ─── Customer status / deletion ───────────────────────────────────────────────
export const portalUpdateCustomerStatus = (id: number, status: string, reason?: string) =>
  request<any>(`/website/customers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
export const portalDeleteCustomer = (id: number) =>
  request<void>(`/website/customers/${id}`, { method: "DELETE" });
export const portalGetCustomerAuditLog = (id: number) =>
  request<any[]>(`/website/customers/${id}/audit-log`);

// ─── Customer Information Team Review ─────────────────────────────────────────
export const portalListInformationChangeRequests = (status?: string) =>
  request<any[]>(`/website/information-change-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`);
export const portalReviewInformationChangeRequest = (
  id: number,
  body: { status: "approved" | "rejected"; decisionReason?: string },
) => request<any>(`/website/information-change-requests/${id}/review`, {
  method: "PATCH",
  body: JSON.stringify(body),
});

// ─── Banking review actions ────────────────────────────────────────────────────
export const portalReviewDeposit = (id: number, status: string, notes?: string) =>
  request<any>(`/website/deposits/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes: notes }) });
export const portalReviewKyc = (id: number, status: string, notes?: string) =>
  request<any>(`/website/kyc/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes: notes }) });
export const portalReviewLoan = (id: number, body: object) =>
  request<any>(`/website/loans/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalReviewTransfer = (id: number, status: string, notes?: string) =>
  request<any>(`/website/transfers/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes: notes }) });
export const portalListBankingCustomerActions = () => request<any[]>("/website/banking/actions");
export const portalReviewBankingCustomerAction = (id: number, status: string, adminNotes?: string) =>
  request<any>(`/website/banking/actions/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes }) });
export const portalListBankingMessages = () => request<any[]>("/website/banking/messages");
export const portalReplyBankingMessage = (customerId: number, body: string) =>
  request<any>("/website/banking/messages", { method: "POST", body: JSON.stringify({ customerId, body }) });
export const portalReviewWithdrawal = (id: number, status: string, notes?: string) =>
  request<any>(`/website/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes: notes }) });

// ─── Shipment extra actions ────────────────────────────────────────────────────
export const portalAddEvent = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/events`, { method: "POST", body: JSON.stringify(body) });
export const portalShipmentAction = (id: number, action: string, notes?: string, extra?: object) =>
  request<any>(`/website/shipments/${id}/action`, { method: "PATCH", body: JSON.stringify({ action, notes, ...(extra ?? {}) }) });
export const portalDuplicateShipment = (id: number) =>
  request<any>(`/website/shipments/${id}/duplicate`, { method: "POST" });

// ─── Shipment Bills ────────────────────────────────────────────────────────────
export const portalListBills = (shipmentId: number) => request<any[]>(`/website/shipments/${shipmentId}/bills`);
export const portalCreateBill = (shipmentId: number, body: object) =>
  request<any>(`/website/shipments/${shipmentId}/bills`, { method: "POST", body: JSON.stringify(body) });
export const portalUpdateBill = (billId: number, body: object) =>
  request<any>(`/website/bills/${billId}`, { method: "PATCH", body: JSON.stringify(body) });
export const portalDeleteBill = (billId: number) =>
  request<void>(`/website/bills/${billId}`, { method: "DELETE" });

// ─── Promo Video (portal) ─────────────────────────────────────────────────────
export const portalGetPromoVideo = () => request<any>("/website/promo-video");
export const portalGetPromoVideoViewUrl = () => request<any>("/website/promo-video/view-url");
export const portalRequestPromoVideoUploadUrl = (fileName: string, fileSize: number, contentType: string) =>
  request<{ uploadURL: string; objectPath: string }>("/website/promo-video/upload-url", {
    method: "POST", body: JSON.stringify({ fileName, fileSize, contentType }),
  });
export const portalRegisterPromoVideo = (
  objectPath: string, fileName: string, fileSize: number, contentType: string, opts?: object,
) =>
  request<any>("/website/promo-video", {
    method: "POST", body: JSON.stringify({ objectPath, fileName, fileSize, contentType, ...opts }),
  });
export const portalDeletePromoVideo = () => request<void>("/website/promo-video", { method: "DELETE" });

// ─── Public tracking & payment ────────────────────────────────────────────────
export const publicTrack = (websiteUid: string, trackingNumber: string) =>
  fetch(`${BASE}/public/${encodeURIComponent(websiteUid)}/track/${encodeURIComponent(trackingNumber.trim())}`).then(async r => {
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      const error = new Error(payload.error ?? "Not found") as Error & { status: number };
      error.status = r.status;
      throw error;
    }
    return r.json();
  });
export const publicGetPaymentSettings = (websiteUid: string) =>
  fetch(`${BASE}/public/${websiteUid}/payment-settings`).then(r => r.json());
export const publicSubmitReceipt = (websiteUid: string, billId: number, body: object) =>
  fetch(`${BASE}/public/${websiteUid}/bills/${billId}/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());

// ─── Public promo video ────────────────────────────────────────────────────────
export const publicGetPromoVideo = (websiteUid: string) =>
  fetch(`${BASE}/public/${websiteUid}/promo-video`).then(async r => {
    if (!r.ok) throw new Error("No promo video");
    return r.json();
  });

// ─── Referral Management (Website Admin) ──────────────────────────────────────
export const portalGetReferralSettings = () =>
  request<any>("/website/referrals/settings");

export const portalUpdateReferralSettings = (body: object) =>
  request<any>("/website/referrals/settings", { method: "PUT", body: JSON.stringify(body) });

export const portalGetReferralStats = () =>
  request<any>("/website/referrals/stats");

export const portalGetReferralRewards = (status = "all", planId?: number) => {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (planId !== undefined) params.set("planId", String(planId));
  const qs = params.toString();
  return request<any[]>(`/website/referrals/rewards${qs ? `?${qs}` : ""}`);
};

export const portalGetReferralsByPlan = () =>
  request<any>("/website/referrals/by-plan");

export const portalReviewReferralReward = (id: number, status: string, adminNotes?: string) =>
  request<any>(`/website/referrals/rewards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, adminNotes }),
  });

export const portalGetTopReferrers = () =>
  request<any[]>("/website/referrals/top-referrers");

export const portalExportReferrals = async () => {
  const token = localStorage.getItem("danzy_portal_token");
  const res = await fetch(`${BASE}/website/referrals/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `referral-commissions-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const portalDownloadCommissionReceipt = async (rewardId: number) => {
  const token = localStorage.getItem("danzy_portal_token");
  const res = await fetch(`${BASE}/website/referrals/rewards/${rewardId}/receipt`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Failed to download receipt");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commission-receipt-${rewardId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── KYC Configuration (Master Admin) ──────────────────────────────────────────
export const masterGetKycConfiguration = (websiteId: number) =>
  masterRequest(`/master/websites/${websiteId}/kyc-configuration`);

export const masterUpdateKycConfiguration = (websiteId: number, data: any) =>
  masterRequest(`/master/websites/${websiteId}/kyc-configuration`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ─── KYC Configuration (Website Admin) ─────────────────────────────────────────
export const portalGetKycConfiguration = () =>
  request("/website/kyc-configuration");
