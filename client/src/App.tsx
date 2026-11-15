import { lazy, Suspense, useEffect } from "react";
import "./banking.css";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { applyWebsiteMeta, resetWebsiteMeta } from "@/lib/website-meta";
import { publicInfo } from "@/lib/portal-api";
import { WEBSITE_CONFIG } from "@/config";
import { setAuthTokenGetter } from "@/workspace/api-client-react";
import { PortalAuthProvider, usePortalAuth } from "@/lib/portal-auth";
import { BankingAuthProvider, useBankingAuth } from "@/lib/banking-auth";
import { WebsiteThemeProvider } from "@/lib/website-theme";
import { CustomerLocalizationProvider } from "@/lib/customer-localization";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import { bankingGetSupportWidgetConfig } from "@/lib/banking-api";

const PortalLoginPage = lazy(() => import("@/pages/portal/login"));
const PortalForgotPasswordPage = lazy(() => import("@/pages/portal/forgot-password"));
const PortalResetPasswordPage = lazy(() => import("@/pages/portal/reset-password"));
const PortalPromotionalVideoPage = lazy(() => import("@/pages/portal/promotional-video"));
const PortalSupportPage = lazy(() => import("@/pages/portal/support"));
const PortalSecurityPage = lazy(() => import("@/pages/portal/security"));
const PortalTeamReviewPage = lazy(() => import("@/pages/portal/team-review"));
const PortalEmailSettingsPage = lazy(() => import("@/pages/portal/email-settings"));
const PortalReceiptsPage = lazy(() => import("@/pages/portal/receipts/index"));

const BankingAdminDashboardPage = lazy(() => import("@/pages/portal/banking/dashboard"));
const BankingAdminRegionsPage = lazy(() => import("@/pages/portal/banking/regions"));
const BankingCustomerServicesPage = lazy(() => import("@/pages/portal/banking/customer-services"));
const BankingCustomerEditPage = lazy(() => import("@/pages/portal/banking/customer-edit"));
const BankingCustomersPage = lazy(() => import("@/pages/portal/banking/customers"));
const BankingAccountsPage = lazy(() => import("@/pages/portal/banking/accounts"));
const BankingAdminTransactionsPage = lazy(() => import("@/pages/portal/banking/transactions"));
const BankingAdminApprovalsPage = lazy(() => import("@/pages/portal/banking/approvals"));
const BankingAdminAuditLogsPage = lazy(() => import("@/pages/portal/banking/audit-logs"));
const BankingAdminDepositsPage = lazy(() => import("@/pages/portal/banking/deposits"));
const BankingAdminWithdrawalsPage = lazy(() => import("@/pages/portal/banking/withdrawals"));
const BankingAdminTransfersPage = lazy(() => import("@/pages/portal/banking/transfers"));
const BankingAdminKycPage = lazy(() => import("@/pages/portal/banking/kyc"));
const BankingAdminCardsPage = lazy(() => import("@/pages/portal/banking/cards"));
const BankingAdminSettingsPage = lazy(() => import("@/pages/portal/banking/settings"));
const BankingAdminLoansPage = lazy(() => import("@/pages/portal/banking/loans"));
const BankingAdminAnalyticsPage = lazy(() => import("@/pages/portal/banking/analytics"));

const BankingLoginPage = lazy(() => import("@/pages/banking/login"));
const BankingRegisterPage = lazy(() => import("@/pages/banking/register"));
const BankingVerifyEmailPage = lazy(() => import("@/pages/banking/verify-email"));
const BankingForgotPasswordPage = lazy(() => import("@/pages/banking/forgot-password"));
const BankingResetPasswordPage = lazy(() => import("@/pages/banking/reset-password"));
const BankingDashboardPage = lazy(() => import("@/pages/banking/dashboard"));
const BankingDepositPage = lazy(() => import("@/pages/banking/deposit"));
const BankingWithdrawPage = lazy(() => import("@/pages/banking/withdraw"));
const BankingTransferPage = lazy(() => import("@/pages/banking/transfer"));
const BankingActionsPage = lazy(() => import("@/pages/banking/actions"));
const BankingMessagesPage = lazy(() => import("@/pages/banking/messages"));
const BankingCreditScorePage = lazy(() => import("@/pages/banking/credit-score"));
const BankingTransactionDetailPage = lazy(() => import("@/pages/banking/transaction-detail"));
const BankingTransactionsPage = lazy(() => import("@/pages/banking/transactions"));
const BankingKycPage = lazy(() => import("@/pages/banking/kyc"));
const BankingCardsPage = lazy(() => import("@/pages/banking/cards"));
const BankingNotificationsPage = lazy(() => import("@/pages/banking/notifications"));
const BankingProfilePage = lazy(() => import("@/pages/banking/profile"));
const BankingBeneficiariesPage = lazy(() => import("@/pages/banking/beneficiaries"));
const BankingLoansPage = lazy(() => import("@/pages/banking/loans"));
const BankingStatementsPage = lazy(() => import("@/pages/banking/statements"));
const BankingSettingsPage = lazy(() => import("@/pages/banking/settings"));
const BankingReceiptsPage = lazy(() => import("@/pages/banking/receipts"));
const ReceiptVerificationPage = lazy(() => import("@/pages/receipt-verification"));

const PublicHome = lazy(() => import("@/pages/PublicHome"));
const SiteHomePage = lazy(() => import("@/pages/site/home"));
const SiteTermsPage = lazy(() => import("@/pages/public/terms"));
const SitePrivacyPage = lazy(() => import("@/pages/public/privacy"));
const SiteAboutPage = lazy(() => import("@/pages/public/about"));
const SiteBlogPage = lazy(() => import("@/pages/public/blog"));
const PublicSiteInfoPage = lazy(() => import("@/pages/public/site-info"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

setAuthTokenGetter(() => localStorage.getItem("danzy_token"));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPortalRouteAllowed(location: string, admin: { websiteType?: string; capabilities?: { accountNumber?: boolean } } | null) {
  if (!admin) return true;
  if (location.includes("/banking/")) return admin.websiteType === "banking" && admin.capabilities?.accountNumber === true;
  return true;
}

function PortalGuard({ children, websiteUid }: { children: React.ReactNode; websiteUid: string }) {
  const { isAuthenticated, admin } = usePortalAuth();
  const [location, setLocation] = useLocation();
  const lsToken = localStorage.getItem("danzy_portal_token");
  const lsAdminRaw = localStorage.getItem("danzy_portal_admin");
  const lsAdmin = lsAdminRaw ? (() => { try { return JSON.parse(lsAdminRaw); } catch { return null; } })() : null;
  const effectiveAuthenticated = isAuthenticated || (!!lsToken && !!lsAdmin);
  const storedUid = admin?.websiteUid ?? lsAdmin?.websiteUid;
  const storedSubdomain = admin?.subdomain ?? lsAdmin?.subdomain;
  const urlIsUuid = UUID_REGEX.test(websiteUid);
  const isOwner = storedUid === websiteUid || storedSubdomain === websiteUid;
  const routeAllowed = isPortalRouteAllowed(location, admin ?? lsAdmin);
  useEffect(() => {
    if (!effectiveAuthenticated || !storedUid) { setLocation(`/portal/${websiteUid}/login`); return; }
    if (urlIsUuid && storedSubdomain && storedUid === websiteUid) { setLocation(location.replace(websiteUid, storedSubdomain)); return; }
    if (!isOwner) { setLocation(`/portal/${websiteUid}/login`); return; }
    if (!routeAllowed) setLocation(`/portal/${storedSubdomain ?? storedUid}/dashboard`);
  }, [effectiveAuthenticated, storedUid, storedSubdomain, websiteUid, urlIsUuid, isOwner, routeAllowed, location, setLocation]);
  if (!effectiveAuthenticated || !storedUid || !isOwner || !routeAllowed) return null;
  return <>{children}</>;
}

function BankingGuard({ children, websiteUid }: { children: React.ReactNode; websiteUid: string }) {
  const { isAuthenticated, customer } = useBankingAuth();
  const [location, setLocation] = useLocation();
  const storedUid = customer?.websiteUid;
  const urlIsUuid = UUID_REGEX.test(websiteUid);
  const capabilityAllowsBanking = !customer?.capabilities || customer.capabilities.accountNumber === true;
  useEffect(() => {
    if (!isAuthenticated || !storedUid) { setLocation(`/banking/${websiteUid}/login`); return; }
    if (!capabilityAllowsBanking) { setLocation(`/app/${storedUid}/login`); return; }
    if (!urlIsUuid) { setLocation(location.replace(websiteUid, storedUid)); return; }
    if (storedUid !== websiteUid) { setLocation(`/banking/${websiteUid}/login`); return; }
    if (customer?.kycRequired && customer.kycStatus !== "approved" && !location.endsWith("/kyc")) setLocation(`/banking/${websiteUid}/kyc`);
  }, [isAuthenticated, storedUid, capabilityAllowsBanking, customer?.kycRequired, customer?.kycStatus, websiteUid, urlIsUuid, location, setLocation]);
  if (!isAuthenticated || !storedUid || !capabilityAllowsBanking || (urlIsUuid && storedUid !== websiteUid)) return null;
  return <>{children}</>;
}


function CustomerSupportWidgetLoader({ websiteUid }: { websiteUid: string | null }) {
  useEffect(() => {
    const existing = document.getElementById("avenqora-smartsupp-loader");
    if (!websiteUid) {
      existing?.remove();
      return;
    }
    let cancelled = false;
    bankingGetSupportWidgetConfig().then((config) => {
      if (cancelled) return;
      const current = document.getElementById("avenqora-smartsupp-loader");
      if (!config?.enabled || !config.smartsuppKey?.trim()) {
        current?.remove();
        return;
      }
      if (current) return;
      const key = config.smartsuppKey.trim();
      const smartsuppWindow = window as any;
      smartsuppWindow._smartsupp = smartsuppWindow._smartsupp || {};
      smartsuppWindow._smartsupp.key = key;
      const script = document.createElement("script");
      script.id = "avenqora-smartsupp-loader";
      script.async = true;
      script.src = `https://www.smartsuppchat.com/loader.js?${encodeURIComponent(key)}`;
      script.onload = () => {
        fetch("/api/banking/public/support-widget/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        }).catch(() => undefined);
      };
      script.onerror = () => {
        fetch("/api/banking/public/support-widget/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed" }),
        }).catch(() => undefined);
      };
      document.head.appendChild(script);
    }).catch((error) => {
      console.error("[customer support widget] Could not load configuration", error);
    });
    return () => { cancelled = true; };
  }, [websiteUid]);
  return null;
}

function Router() {
  const [location] = useLocation();
  const websiteUid = location.match(/^\/(?:site|portal|banking)\/([^/]+)/)?.[1] ?? null;
  const customerWebsiteUid = location === "/" ? WEBSITE_CONFIG.websiteUid : location.match(/^\/(?:site|banking)\/([^/]+)/)?.[1] ?? null;
  const { data: website } = useQuery({
    queryKey: ["tenant-website-meta", websiteUid],
    queryFn: () => publicInfo(websiteUid!),
    enabled: Boolean(websiteUid),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  useEffect(() => {
    if (websiteUid && website) {
      applyWebsiteMeta({
        name: website.name,
        primaryColor: website.primaryColor ?? null,
        logoUrl: website.logoUrl ?? null,
        faviconUrl: website.faviconUrl ?? null,
      });
    } else if (location === "/") {
      applyWebsiteMeta({
        name: WEBSITE_CONFIG.name,
        primaryColor: WEBSITE_CONFIG.primaryColor ?? null,
        logoUrl: WEBSITE_CONFIG.logoUrl || null,
      });
    } else {
      resetWebsiteMeta();
    }
  }, [location, websiteUid, website?.name, website?.primaryColor, website?.logoUrl, website?.faviconUrl]);
  const loadingUid = location.match(/^\/(?:banking|site)\/([^/]+)/)?.[1] ?? null;
  return (
    <>
      <CustomerSupportWidgetLoader websiteUid={customerWebsiteUid} />
      <Suspense fallback={<CustomerBrandLoader websiteUid={loadingUid} websiteType={location.startsWith("/banking/") ? "banking" : undefined} fullScreen label="Loading customer portal" />}>
      <Switch>
        <Route path="/receipt/verify/:token">{(params) => <ReceiptVerificationPage params={params as { token: string }} />}</Route>
        <Route path="/">{() => <PublicHome onCustomerLogin={() => undefined} onStaffLogin={() => undefined} />}</Route>
        <Route path="/portal/:websiteUid/login">{(params) => <PortalLoginPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/portal/:websiteUid/forgot-password">{(params) => <PortalForgotPasswordPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/portal/:websiteUid/reset-password">{(params) => <PortalResetPasswordPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/portal/:websiteUid/promotional-video">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalPromotionalVideoPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/support">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalSupportPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/security">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalSecurityPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/team-review">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalTeamReviewPage params={params as { websiteUid: string }} /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/email-settings">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalEmailSettingsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/receipts">{(params) => <PortalGuard websiteUid={params.websiteUid}><PortalReceiptsPage /></PortalGuard>}</Route>

        <Route path="/portal/:websiteUid/dashboard">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminDashboardPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/dashboard">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminDashboardPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/regions">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminRegionsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/customer-services">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingCustomerServicesPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/customers/:customerId">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingCustomerEditPage params={params as { websiteUid: string; customerId: string }} /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/customers">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingCustomersPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/accounts">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAccountsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/transactions">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminTransactionsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/approvals">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminApprovalsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/audit-logs">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminAuditLogsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/deposits">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminDepositsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/withdrawals">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminWithdrawalsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/transfers">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminTransfersPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/kyc">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminKycPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/cards">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminCardsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/settings">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminSettingsPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/loans">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminLoansPage /></PortalGuard>}</Route>
        <Route path="/portal/:websiteUid/banking/analytics">{(params) => <PortalGuard websiteUid={params.websiteUid}><BankingAdminAnalyticsPage /></PortalGuard>}</Route>

        <Route path="/banking/:websiteUid/login">{(params) => <BankingLoginPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/banking/:websiteUid/register">{(params) => <BankingRegisterPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/banking/:websiteUid/verify-email">{(params) => <BankingVerifyEmailPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/banking/:websiteUid/forgot-password">{(params) => <BankingForgotPasswordPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/banking/:websiteUid/reset-password">{(params) => <BankingResetPasswordPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/banking/:websiteUid/dashboard">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingDashboardPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/deposit">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingDepositPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/withdraw">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingWithdrawPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/transfer">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingTransferPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/actions/:actionType">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingActionsPage params={params as { websiteUid: string; actionType: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/messages">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingMessagesPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/credit-score">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingCreditScorePage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/transactions/:id">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingTransactionDetailPage params={params as { websiteUid: string; id: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/transactions">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingTransactionsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/kyc">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingKycPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/cards">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingCardsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/notifications">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingNotificationsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/profile">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingProfilePage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/beneficiaries">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingBeneficiariesPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/loans">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingLoansPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/statements">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingStatementsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/settings">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingSettingsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>
        <Route path="/banking/:websiteUid/receipts">{(params) => <BankingGuard websiteUid={params.websiteUid}><BankingReceiptsPage params={params as { websiteUid: string }} /></BankingGuard>}</Route>

        <Route path="/site/:websiteUid/terms">{(params) => <SiteTermsPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/site/:websiteUid/privacy">{(params) => <SitePrivacyPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/site/:websiteUid/about">{(params) => <SiteAboutPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/site/:websiteUid/blog">{(params) => <SiteBlogPage params={params as { websiteUid: string }} />}</Route>
        <Route path="/site/:websiteUid/:page">{(params) => <PublicSiteInfoPage params={params as { websiteUid: string; page: string }} />}</Route>
        <Route path="/site/:websiteUid">{(params) => <SiteHomePage params={params as { websiteUid: string }} />}</Route>
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </>
  );
}

function AppProviders() {
  return <QueryClientProvider client={queryClient}>
    <PortalAuthProvider>
      <BankingAuthProvider>
        <TooltipProvider>
          <WouterRouter>
            <WebsiteThemeProvider>
              <CustomerLocalizationProvider><Router /></CustomerLocalizationProvider>
            </WebsiteThemeProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </BankingAuthProvider>
    </PortalAuthProvider>
  </QueryClientProvider>;
}

export default function App() {
  return <AppProviders />;
}
