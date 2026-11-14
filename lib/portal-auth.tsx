import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const PORTAL_TOKEN_KEY = "danzy_portal_token";
const PORTAL_ADMIN_KEY = "danzy_portal_admin";

export interface PortalAdmin {
  id: number;
  websiteId: number;
  websiteUid: string;
  subdomain?: string | null;
  websiteName: string;
  websiteType: string;
  primaryColor?: string;
  logoUrl?: string | null;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  capabilities?: {
    teamReview?: boolean;
    payment?: boolean;
    kycSupported?: boolean;
    customerAccounts?: boolean;
    accountNumber?: boolean;
    wallet?: boolean;
    balance?: boolean;
    financialTransactions?: boolean;
    transactionPin?: boolean;
    paymentMethods?: string[];
    paymentReview?: boolean;
    paymentEvidence?: boolean;
    customerApproval?: boolean;
    customerFeatures?: string[];
    adminFeatures?: string[];
    recordLabelSingular?: string;
    recordLabelPlural?: string;
    recordCategory?: string | null;
    actionLabel?: string | null;
  };
}

interface PortalAuthCtx {
  token: string | null;
  admin: PortalAdmin | null;
  login: (token: string, admin: PortalAdmin) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const PortalAuthContext = createContext<PortalAuthCtx>({
  token: null, admin: null,
  login: () => {}, logout: () => {}, isAuthenticated: false,
});

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(PORTAL_TOKEN_KEY));
  const [admin, setAdmin] = useState<PortalAdmin | null>(() => {
    const raw = localStorage.getItem(PORTAL_ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((t: string, a: PortalAdmin) => {
    localStorage.setItem(PORTAL_TOKEN_KEY, t);
    localStorage.setItem(PORTAL_ADMIN_KEY, JSON.stringify(a));
    setToken(t);
    setAdmin(a);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    localStorage.removeItem(PORTAL_ADMIN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  return (
    <PortalAuthContext.Provider value={{ token, admin, login, logout, isAuthenticated: !!token && !!admin }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

export function getPortalToken() {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}
