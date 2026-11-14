import { useSyncExternalStore } from "react";

export type BankingAdminRegion = "ALL" | "USA" | "EUROPE";

const STORAGE_KEY = "danzy_banking_admin_region";
const REGION_CHANGE_EVENT = "danzy-banking-admin-region-change";

function readBankingAdminRegion(): BankingAdminRegion {
  if (typeof window === "undefined") return "ALL";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "USA" || stored === "EUROPE" ? stored : "ALL";
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(REGION_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(REGION_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useBankingAdminRegion(): BankingAdminRegion {
  return useSyncExternalStore(subscribe, readBankingAdminRegion, () => "ALL");
}

export function setBankingAdminRegion(region: BankingAdminRegion): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, region);
  window.dispatchEvent(new Event(REGION_CHANGE_EVENT));
}