import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface BankingCustomer {
  id: number;
  websiteId: number;
  websiteUid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  country?: string | null;
  status: string;
  kycStatus: string;
  kycRequired?: boolean;
  emailVerified: boolean;
  profilePhotoUrl?: string | null;
  rejectionReason?: string | null;
  /** Website's primary brand color — drives the customer dashboard theme */
  primaryColor?: string;
  /** Website logo URL — displayed in sidebar header and dashboards */
  logoUrl?: string | null;
  /** Regional presentation for the customer banking experience. */
  bankingRegion?: string | null;
  banking_region?: string | null;
  websiteType?: string;
  capabilities?: {
    customerAccounts?: boolean;
    accountNumber?: boolean;
    payment?: boolean;
    kycSupported?: boolean;
    transactionPin?: boolean;
  };
}

const BANKING_TOKEN_KEY = "danzy_banking_token";
const BANKING_CUSTOMER_KEY = "danzy_banking_customer";

interface BankingAuthCtx {
  token: string | null;
  customer: BankingCustomer | null;
  login: (token: string, customer: BankingCustomer) => void;
  logout: () => void;
  setCustomer: (c: BankingCustomer) => void;
  isAuthenticated: boolean;
}

const BankingAuthContext = createContext<BankingAuthCtx>({
  token: null,
  customer: null,
  login: () => {},
  logout: () => {},
  setCustomer: () => {},
  isAuthenticated: false,
});

export function BankingAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(BANKING_TOKEN_KEY),
  );
  const [customer, setCustomerState] = useState<BankingCustomer | null>(() => {
    const raw = localStorage.getItem(BANKING_CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((t: string, c: BankingCustomer) => {
    localStorage.setItem(BANKING_TOKEN_KEY, t);
    localStorage.setItem(BANKING_CUSTOMER_KEY, JSON.stringify(c));
    setToken(t);
    setCustomerState(c);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(BANKING_TOKEN_KEY);
    localStorage.removeItem(BANKING_CUSTOMER_KEY);
    setToken(null);
    setCustomerState(null);
  }, []);

  const setCustomer = useCallback((c: BankingCustomer) => {
    localStorage.setItem(BANKING_CUSTOMER_KEY, JSON.stringify(c));
    setCustomerState(c);
  }, []);

  useEffect(() => {
    const handleSuspension = () => logout();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BANKING_TOKEN_KEY && event.newValue === null) logout();
    };
    window.addEventListener("avenqora:customer-suspended", handleSuspension);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("avenqora:customer-suspended", handleSuspension);
      window.removeEventListener("storage", handleStorage);
    };
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    const checkSuspension = async () => {
      try {
        const response = await fetch("/api/customer/profile", {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (body.code === "ACCOUNT_SUSPENDED") {
            window.dispatchEvent(new Event("avenqora:customer-suspended"));
          }
        }
      } catch {
        // Network interruptions do not sign customers out.
      }
    };
    void checkSuspension();
    const interval = window.setInterval(checkSuspension, 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  return (
    <BankingAuthContext.Provider
      value={{ token, customer, login, logout, setCustomer, isAuthenticated: !!token && !!customer }}
    >
      {children}
    </BankingAuthContext.Provider>
  );
}

export function useBankingAuth() {
  return useContext(BankingAuthContext);
}

export function getBankingToken(): string | null {
  return localStorage.getItem(BANKING_TOKEN_KEY);
}
