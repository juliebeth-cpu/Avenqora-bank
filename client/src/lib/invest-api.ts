const BASE = "/api";

function getToken() { return localStorage.getItem("danzy_invest_token"); }
function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status, data: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const investRegister = (body: object) => request<any>("/customer/auth/register", { method: "POST", body: JSON.stringify(body) });
export const investLogin = (body: object) => request<{ token: string; customer: any }>("/customer/auth/login", { method: "POST", body: JSON.stringify(body) });
export const investMe = () => request<any>("/customer/auth/me");
export const investLogout = () => request<any>("/customer/auth/logout", { method: "POST" });

// Dashboard
export const investDashboard = () => request<any>("/customer/invest/dashboard");

// Plans
export const investListPlans = (websiteUid: string) => request<any[]>(`/public/${websiteUid}/invest/plans`);
export const investStartInvestment = (body: object) => request<any>("/customer/invest/investments", { method: "POST", body: JSON.stringify(body) });

// My Investments
export const investMyInvestments = () => request<any[]>("/customer/invest/investments");
export const investCancelInvestment = (id: number, transactionPin: string) => request<any>(`/customer/invest/investments/${id}/cancel`, { method: "POST", body: JSON.stringify({ transactionPin }) });

// Wallet
export const investWallet = () => request<any>("/customer/invest/wallet");

// Earnings
export const investEarnings = () => request<any>("/customer/invest/earnings");

// Transactions
export const investTransactions = () => request<any>("/customer/invest/transactions");

// Referral
export const investReferral = () => request<any>("/customer/invest/referral");
export const investReferralPublicSettings = (websiteUid: string) => request<any>(`/public/${websiteUid}/referral/settings`);

// Deposits (reuse customer routes)
export const investListDeposits = () => request<any[]>("/customer/deposits");
export const investCreateDeposit = (body: object) => request<any>("/customer/deposits", { method: "POST", body: JSON.stringify(body) });
export const investAttachReceipt = (id: number, receiptUrl: string) => request<any>(`/customer/deposits/${id}/receipt`, { method: "POST", body: JSON.stringify({ receiptUrl }) });
export const investListDepositWallets = () => request<any[]>("/customer/deposit-wallets");

// Admin – Deposit Wallets
function portalReq<T>(path: string, init?: RequestInit): Promise<T> {
  const t = localStorage.getItem("danzy_portal_token");
  return fetch(`/api${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } })
    .then(r => r.ok ? (r.status === 204 ? undefined as T : r.json()) : r.json().then((e: any) => Promise.reject(new Error(e.error ?? "Error"))));
}
export const investAdminListWallets = () => portalReq<any[]>("/website/deposit-wallets");
export const investAdminCreateWallet = (body: object) => portalReq<any>("/website/deposit-wallets", { method: "POST", body: JSON.stringify(body) });
export const investAdminUpdateWallet = (id: number, body: object) => portalReq<any>(`/website/deposit-wallets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const investAdminDeleteWallet = (id: number) => portalReq<void>(`/website/deposit-wallets/${id}`, { method: "DELETE" });

// Admin – Deposit review for investment (extended statuses)
export const investAdminListDeposits = () => portalReq<any[]>("/website/invest/deposits");
export const investAdminReviewDeposit = (id: number, status: string, adminNotes?: string) =>
  portalReq<any>(`/website/deposits/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNotes }) });

// Withdrawals (reuse customer routes)
export const investListWithdrawals = () => request<any[]>("/customer/withdrawals");
export const investCreateWithdrawal = (body: object) => request<any>("/customer/withdrawals", { method: "POST", body: JSON.stringify(body) });

// KYC
export const investKyc = () => request<any>("/customer/kyc");
export const investSubmitKyc = (body: object) => request<any>("/customer/kyc", { method: "POST", body: JSON.stringify(body) });

// Notifications
export const investListNotifications = () => request<any[]>("/customer/notifications");
export const investMarkNotificationRead = (id: number) => request<any>(`/customer/notifications/${id}/read`, { method: "PATCH" });

// Profile
export const investGetProfile = () => request<any>("/customer/profile");
export const investUpdateProfile = (body: object) => request<any>("/customer/profile", { method: "PATCH", body: JSON.stringify(body) });
export const investUpdatePhoto = (profilePhotoUrl: string) => request<any>("/customer/profile/photo", { method: "POST", body: JSON.stringify({ profilePhotoUrl }) });
export const investChangePassword = (body: object) => request<any>("/customer/profile/password", { method: "PATCH", body: JSON.stringify(body) });

// Receipts
export const investListReceipts = () => request<any[]>("/customer/receipts");
export const investGetReceipt = (id: number) => request<any>(`/customer/receipts/${id}`);

// Public
export const investPublicInfo = (websiteUid: string) => request<any>(`/public/${websiteUid}/info`);
