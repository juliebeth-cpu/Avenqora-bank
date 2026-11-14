import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Bell,
  ChartNoAxesColumnIncreasing, ChevronRight, CircleDollarSign, CreditCard,
  Eye, EyeOff, FileText, History, MessageSquare, RefreshCw, Send, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useBankingAuth } from "@/lib/banking-auth";
import { useCustomerLocalization } from "@/lib/customer-localization";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingDashboard, bankingGetCreditScore, estimateBankingServerNow } from "@/lib/banking-api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  formatBankingAmount, formatBankingTransactionDateTime, getBankingRegionalConfig, maskBankingAccount,
} from "@/lib/banking-region";
import { transactionStatusLabel } from "@/lib/transaction-status";

interface Props { params: { websiteUid: string } }
interface AccountRecord {
  id: number;
  accountNumber?: string | null;
  accountType?: string | null;
  balance: number | string;
  currency?: string | null;
}
interface TransactionRecord {
  id: number;
  transactionType?: string | null;
  direction?: string | null;
  amount: number | string;
  grossAmount?: number | string | null;
  fee?: number | string | null;
  totalDebit?: number | string | null;
  currency?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  sender?: { name?: string | null } | null;
  receiver?: { name?: string | null } | null;
  senderName?: string | null;
  receiverName?: string | null;
}
interface ResumableDepositRecord {
  id: number;
  amount: number | string;
  currency: string;
  method: string;
  reference: string;
  sessionExpiresAt?: string | null;
}

const QUERY_OPTS = { staleTime: 5_000, refetchInterval: 30_000, refetchIntervalInBackground: false };

function transactionIcon(type?: string | null) {
  if (type === "credit" || type === "deposit") return ArrowDownLeft;
  if (type === "debit" || type === "withdrawal") return ArrowUpRight;
  return ArrowLeftRight;
}
function displayType(value?: string | null) {
  return String(value || "Account").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function transactionTone(type?: string | null, direction?: string | null) {
  if (direction === "incoming" || type === "credit" || type === "deposit") return { color: "#187452", background: "#e5f3ec", prefix: "+" };
  if (direction === "outgoing" || type === "debit" || type === "withdrawal") return { color: "#a54a43", background: "#faeeeb", prefix: "−" };
  return { color: "#546b7a", background: "#eaf0f3", prefix: "" };
}

function transactionTitle(transaction: TransactionRecord) {
  if (transaction.transactionType === "transfer") {
    const counterparty = transaction.direction === "incoming"
      ? transaction.sender?.name ?? transaction.senderName
      : transaction.receiver?.name ?? transaction.receiverName;
    if (counterparty?.trim()) {
      return `Transfer ${transaction.direction === "incoming" ? "from" : "to"} ${counterparty.trim()}`;
    }
  }
  return transaction.description || displayType(transaction.transactionType);
}

function isSuccessful(status?: string | null) {
  return ["approved", "completed", "paid", "successful"].includes(String(status ?? "").toLowerCase());
}

function displayAmount(transaction: TransactionRecord) {
  if (transaction.transactionType === "transfer" && transaction.direction !== "incoming") {
    return Number(transaction.totalDebit ?? (Number(transaction.grossAmount ?? transaction.amount) + Number(transaction.fee ?? 0)));
  }
  return Number(transaction.amount) || 0;
}

function depositCountdown(expiresAt: string, now: number) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  if (remainingSeconds === 0) return "Expired";
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function BankingDashboardPage({ params }: Props) {
  const { websiteUid } = params;
  const { customer } = useBankingAuth();
  const { t } = useCustomerLocalization();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [clockNow, setClockNow] = useState(0);
  const regional = useMemo(
    () => getBankingRegionalConfig(customer),
    [customer?.bankingRegion, customer?.banking_region, customer?.country],
  );
  const base = `/banking/${websiteUid}`;
  const dashboardQuery = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: bankingDashboard,
    ...QUERY_OPTS,
  });
  const creditScoreQuery = useQuery({
    queryKey: ["banking-credit-score"],
    queryFn: bankingGetCreditScore,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const dashboard = dashboardQuery.data;
  useEffect(() => {
    const updateClock = () => setClockNow(estimateBankingServerNow(dashboard));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [dashboard?.serverTime, dashboard?.serverTimeMonotonicAnchorMs]);
  const serverNow = clockNow || estimateBankingServerNow(dashboard);
  const accounts: AccountRecord[] = dashboard?.accounts ?? [];
  const primaryAccount = accounts[0];
  const otherAccounts = accounts.slice(1);
  const transactions: TransactionRecord[] = (dashboard?.recentTransactions ?? []).slice(0, 3);
  const resumableDeposits: ResumableDepositRecord[] = (dashboard?.resumableDeposits ?? []).filter((deposit: ResumableDepositRecord) =>
    !deposit.sessionExpiresAt || new Date(deposit.sessionExpiresAt).getTime() > serverNow,
  );
  const primaryCurrency = primaryAccount?.currency || regional.fallbackCurrency;
  const balanceParts = primaryAccount
    ? new Intl.NumberFormat(regional.locale, {
        style: "currency",
        currency: primaryCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).formatToParts(Number(primaryAccount.balance) || 0)
    : [];
  const score = Number(creditScoreQuery.data?.score ?? 165);
  const scoreProgress = Math.max(0, Math.min(100, ((score - 165) / 685) * 100));
  const unreadCount = Number(dashboard?.unreadNotifications ?? 0);
  const displayName = customer?.firstName || customer?.username || "there";
  type QuickAction = {
    key: string;
    label: string;
    icon: LucideIcon;
    href?: string;
    disabled?: boolean;
    disabledLabel?: string;
  };
  const quickActions: Record<string, QuickAction> = {
    bills: { key: "bills", label: "Pay Bills", icon: FileText, href: `${base}/actions/bill_payment` },
    transfer: {
      key: "transfer",
      label: regional.region === "EUROPE" ? "Transfer" : "Transfer Money",
      icon: ArrowLeftRight,
      href: `${base}/transfer`,
    },
    zelle: { key: "zelle", label: "Zelle", icon: CircleDollarSign, href: `${base}/actions/zelle` },
    deposit: { key: "deposit", label: "Deposit", icon: ArrowDownToLine, href: `${base}/deposit` },
    "sending-order": { key: "sending-order", label: "Sending Order", icon: Send, href: `${base}/actions/sending_order` },
    cards: { key: "cards", label: "Card", icon: CreditCard, href: `${base}/cards` },
    message: { key: "message", label: "Message", icon: MessageSquare, href: `${base}/messages` },
  };
  const actions: QuickAction[] = regional.actionOrder.flatMap((key) => {
    const action = quickActions[key];
    return action ? [action] : [];
  });
  const additionalActions = actions.filter((action) => action.key !== "transfer");

  return (
    <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
      <div className="banking-dashboard mx-auto w-full max-w-[620px] space-y-4 sm:space-y-5" data-testid="banking-dashboard">
        <header className="flex items-start justify-between gap-3" data-testid="dashboard-header">
          <div className="min-w-0">
            <h1 className="bank-title text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="text-customer-greeting">
              Hi, {displayName}
            </h1>
            <p className="bank-muted mt-1 text-sm">Here’s your financial overview.</p>
          </div>
          <Link
            href={`${base}/notifications`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bank-surface text-[var(--bank-muted)] transition-colors hover:bg-[var(--bank-surface-soft)]"
            aria-label={t("Notifications")}
            data-testid="link-dashboard-notifications"
          >
            <Bell className="h-[19px] w-[19px]" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bank-accent)] px-1 text-[10px] font-bold text-white" data-testid="status-unread-notifications">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </Link>
        </header>

        {dashboardQuery.isError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="status-dashboard-error">
            <div>
              <p className="text-sm font-semibold text-rose-900">We couldn’t refresh your banking information.</p>
              <p className="mt-1 text-xs text-rose-800/75">Your connection may be interrupted. Try again shortly.</p>
            </div>
            <button type="button" onClick={() => void dashboardQuery.refetch()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-900 hover:bg-rose-50" data-testid="button-retry-dashboard">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}

        <section
          className="overflow-hidden rounded-2xl border border-white/15 px-4 py-4 text-white shadow-sm sm:rounded-3xl sm:px-6 sm:py-5"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--bank-accent, #2563eb) 68%, #17304f), #17304f)" }}
          aria-label="Available balance"
          data-testid="card-primary-balance"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/75">Available balance</p>
              <p
                className="mt-2 flex min-h-10 min-w-0 flex-wrap items-baseline gap-x-1 font-semibold tracking-tight tabular-nums"
                aria-label={
                  !primaryAccount
                    ? "Balance unavailable"
                    : balanceVisible
                      ? formatBankingAmount(primaryAccount.balance, primaryCurrency, regional)
                      : "Balance hidden"
                }
                data-testid="text-primary-balance"
              >
                {dashboardQuery.isLoading ? (
                  <span className="text-3xl sm:text-4xl">—</span>
                ) : !primaryAccount ? (
                  <span className="text-base font-medium">No account available</span>
                ) : balanceVisible ? (
                  balanceParts.map((part, index) => (
                    <span
                      key={`${part.type}-${index}`}
                      className={part.type === "currency" || part.type === "literal" ? "text-base font-medium text-white/85 sm:text-lg" : "text-3xl sm:text-4xl"}
                    >
                      {part.value}
                    </span>
                  ))
                ) : (
                  <span className="text-3xl tracking-[0.18em] sm:text-4xl" aria-label="Hidden balance">••••••</span>
                )}
              </p>
              <p className="mt-2 truncate font-mono text-[10px] tracking-wide text-white/65 sm:text-[11px]">
                {primaryAccount ? maskBankingAccount(primaryAccount.accountNumber) : "Your account details will appear here"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBalanceVisible((visible) => !visible)}
              disabled={!primaryAccount || dashboardQuery.isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={balanceVisible ? "Hide balance" : "Show balance"}
              aria-pressed={!balanceVisible}
              data-testid="button-toggle-balance"
            >
              {balanceVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-3 text-xs">
            <span className="text-white/70">Account status</span>
            <span className="font-semibold capitalize">
              {String((customer as any)?.status ?? "active").replace(/[_-]/g, " ")}
            </span>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Primary banking actions">
          <Link
            href={`${base}/transfer`}
            className="bank-surface flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition hover:border-[var(--bank-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bank-accent)] sm:min-h-[84px]"
            data-testid="link-quick-action-transfer"
          >
            <ArrowUpRight className="h-5 w-5 bank-title" />
            <span className="text-xs font-semibold">Transfer</span>
          </Link>
          <button
            type="button"
            onClick={() => setReceiveOpen(true)}
            className="bank-surface flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-[var(--bank-text)] transition hover:border-[var(--bank-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bank-accent)] sm:min-h-[84px]"
            aria-haspopup="dialog"
            data-testid="button-quick-action-receive"
          >
            <ArrowDownLeft className="h-5 w-5" />
            <span className="text-xs font-semibold">Receive</span>
          </button>
          <Link
            href={`${base}/transactions`}
            className="bank-surface flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition hover:border-[var(--bank-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bank-accent)] sm:min-h-[84px]"
            data-testid="link-quick-action-history"
          >
            <History className="h-5 w-5 bank-title" />
            <span className="text-xs font-semibold">History</span>
          </Link>
        </section>

        {additionalActions.length > 0 && (
          <section aria-labelledby="additional-actions-heading">
            <h2 id="additional-actions-heading" className="bank-title mb-2 text-xs font-semibold uppercase tracking-wide">More banking actions</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
              {additionalActions.map(({ key, label, icon: Icon, href, disabled, disabledLabel }) => {
                const content = (
                  <>
                    <span className="bank-soft flex h-9 w-9 items-center justify-center rounded-xl bank-accent"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="mt-2 text-center text-[10px] font-semibold leading-tight sm:text-xs">{label}</span>
                    {disabled && <span className="mt-1 text-[9px] font-medium leading-tight text-amber-700">{disabledLabel ?? "Unavailable"}</span>}
                  </>
                );
                return disabled ? (
                  <button key={key} type="button" disabled aria-disabled="true" title={`${label}: ${disabledLabel ?? "Unavailable"}`} className="bank-surface flex min-h-[82px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1.5 py-3 text-[var(--bank-muted)] opacity-75" data-testid={`button-quick-action-${key}-disabled`}>
                    {content}
                  </button>
                ) : (
                  <Link key={key} href={href!} className="bank-surface flex min-h-[82px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1.5 py-3 text-[var(--bank-text)] transition-transform hover:-translate-y-0.5" data-testid={`link-quick-action-${key}`}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="bank-surface rounded-2xl border p-4 sm:p-5" aria-labelledby="credit-score-heading">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="credit-score-heading" className="bank-title text-sm font-semibold">Credit score</h2>
              <p className="bank-title mt-2 text-2xl font-bold tabular-nums">
                {creditScoreQuery.isError ? "Unavailable" : creditScoreQuery.isLoading ? "—" : score}
              </p>
            </div>
            <Link
              href={`${base}/credit-score`}
              className="bank-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bank-surface-soft)] transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bank-accent)]"
              aria-label="View credit score details"
              data-testid="link-credit-score-details"
            >
              <ChartNoAxesColumnIncreasing className="h-5 w-5" />
            </Link>
          </div>
          {!creditScoreQuery.isError && (
            <div className="mt-3">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-[var(--bank-surface-soft)]"
                role="progressbar"
                aria-label="Credit score range"
                aria-valuemin={165}
                aria-valuemax={850}
                aria-valuenow={creditScoreQuery.isLoading ? 165 : score}
              >
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${creditScoreQuery.isLoading ? 0 : scoreProgress}%` }} />
              </div>
            </div>
          )}
        </section>

        {resumableDeposits.length > 0 && (
          <section className="bank-surface rounded-2xl border p-4 sm:p-5" aria-labelledby="resume-deposit-heading" data-testid="section-resumable-deposits">
            <div className="flex items-center justify-between gap-3">
              <h2 id="resume-deposit-heading" className="bank-title text-sm font-semibold">Pending deposits</h2>
              <span className="bank-muted text-xs">Continue where you left off</span>
            </div>
            <div className="mt-3 space-y-2">
              {resumableDeposits.map((deposit) => (
                <article key={deposit.id} className="flex flex-col gap-3 rounded-xl border border-[var(--bank-line)] p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`card-resumable-deposit-${deposit.id}`}>
                  <div className="min-w-0">
                    <p className="bank-title text-sm font-semibold">{formatBankingAmount(deposit.amount, deposit.currency, regional)}</p>
                    <p className="bank-muted mt-1 truncate text-xs">{displayType(deposit.method)} · Ref {deposit.reference}</p>
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {deposit.sessionExpiresAt ? `Time remaining: ${depositCountdown(deposit.sessionExpiresAt, serverNow)}` : "Legacy deposit · no expiry set"}
                    </p>
                  </div>
                  <Link
                    href={`${base}/deposit?resumeDepositId=${deposit.id}`}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bank-accent)] px-4 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bank-accent)]"
                    data-testid={`link-resume-deposit-${deposit.id}`}
                  >
                    Resume deposit
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="bank-surface overflow-hidden rounded-2xl border" aria-labelledby="recent-activity-heading" data-testid="card-recent-transactions">
          <div className="flex items-center justify-between border-b border-[var(--bank-line)] px-4 py-4 sm:px-5">
            <h2 id="recent-activity-heading" className="bank-title text-sm font-semibold">Recent transactions</h2>
            <Link href={`${base}/transactions`} className="bank-accent flex min-h-8 items-center gap-1 text-xs font-semibold hover:opacity-75" data-testid="link-view-all-transactions">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {dashboardQuery.isLoading ? (
            <div className="divide-y divide-[var(--bank-line)]" aria-label="Loading activity">
              {[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-3 px-4 py-4 sm:px-5"><div className="h-10 w-10 animate-pulse rounded-full bg-[var(--bank-surface-soft)]" /><div className="flex-1 space-y-2"><div className="h-3 w-36 animate-pulse rounded bg-[var(--bank-surface-soft)]" /><div className="h-2.5 w-24 animate-pulse rounded bg-[var(--bank-surface-soft)]" /></div><div className="h-3 w-16 animate-pulse rounded bg-[var(--bank-surface-soft)]" /></div>)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="px-5 py-9 text-center" data-testid="empty-recent-transactions">
              <FileText className="bank-muted mx-auto h-6 w-6" />
              <p className="bank-title mt-3 text-sm font-semibold">{t("No transactions yet")}</p>
              <p className="bank-muted mt-1 text-xs">{t("Your transactions will appear here")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--bank-line)]">
              {transactions.map((transaction) => {
                const Icon = transactionIcon(transaction.transactionType);
                const tone = transactionTone(transaction.transactionType, transaction.direction);
                return (
                  <div key={transaction.id} className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5" data-testid={`row-transaction-${transaction.id}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ color: tone.color, background: tone.background }}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="bank-title truncate text-[13px] font-medium">{transactionTitle(transaction)}</p>
                      <p className="bank-muted mt-0.5 flex min-w-0 items-center gap-1 truncate text-[10px]">
                        {displayType(transaction.transactionType)}
                        {(isSuccessful(transaction.status) ? transaction.completedAt ?? transaction.createdAt : transaction.createdAt)
                          ? ` · ${formatBankingTransactionDateTime(
                              isSuccessful(transaction.status) ? transaction.completedAt ?? transaction.createdAt! : transaction.createdAt!,
                              regional,
                            )}`
                          : ""}
                        {transaction.status && <> · <span className={
                          isSuccessful(transaction.status)
                            ? "font-medium text-emerald-500"
                            : transactionStatusLabel(transaction.status) === "Pending"
                              ? "font-medium text-slate-400"
                              : "font-medium text-rose-400"
                        }>{transactionStatusLabel(transaction.status)}</span></>}
                      </p>
                    </div>
                    <p className="w-[104px] shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color: tone.color }}>
                      {tone.prefix}{formatBankingAmount(Math.abs(displayAmount(transaction)), transaction.currency || primaryCurrency, regional)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {otherAccounts.length > 0 && (
          <section aria-labelledby="other-accounts-heading" data-testid="section-other-accounts">
            <h2 id="other-accounts-heading" className="bank-title mb-2 text-xs font-semibold uppercase tracking-wide">Other accounts</h2>
            <div className="space-y-2">
              {otherAccounts.map((account) => (
                <article key={account.id} className="bank-surface flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border px-4 py-3" data-testid={`card-account-${account.id}`}>
                  <div className="min-w-0">
                    <p className="bank-title truncate text-sm font-semibold">{displayType(account.accountType)}</p>
                    <p className="bank-muted mt-1 truncate font-mono text-[10px]">{account.accountNumber ? maskBankingAccount(account.accountNumber) : "Account number unavailable"}</p>
                  </div>
                  <p className="bank-title shrink-0 text-right text-sm font-semibold tabular-nums">
                    {formatBankingAmount(account.balance, account.currency || regional.fallbackCurrency, regional)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="bank-muted pb-2 text-center text-[10px]">Your account information is private and protected.</p>
      </div>
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Receive a transfer</DialogTitle>
            <DialogDescription>
              Share these account details with someone who is sending you money.
            </DialogDescription>
          </DialogHeader>
          {accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <article key={account.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{displayType(account.accountType)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{account.currency || regional.fallbackCurrency}</p>
                    </div>
                    <Wallet className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  </div>
                  <div className="mt-4 space-y-3 border-t border-border pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Account holder</p>
                      <p className="mt-1 text-sm font-medium">
                        {[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customer?.username || "Account holder"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Account number</p>
                      <p className="mt-1 break-all font-mono text-sm font-medium" data-testid={`text-receive-account-number-${account.id}`}>
                        {account.accountNumber || "Account number unavailable"}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
              <p className="text-xs text-muted-foreground">Never share your password or transaction PIN.</p>
            </div>
          ) : (
            <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              No account details are available yet.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CustomerBankingLayout>
  );
}