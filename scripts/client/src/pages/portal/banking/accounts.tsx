import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { portalListCustomers, portalListAccounts, portalFundAccount, portalDebitAccount } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Search, PlusCircle, MinusCircle } from "lucide-react";

export default function BankingAccountsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<"fund" | "debit">("fund");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const { data: accounts = [], isLoading } = useQuery({ queryKey: ["portal-accounts"], queryFn: () => portalListAccounts() });
  const { data: customers = [] } = useQuery({ queryKey: ["portal-customers"], queryFn: portalListCustomers });

  const customerById = new Map((customers as any[]).map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

  const actionMutation = useMutation({
    mutationFn: () => action === "fund"
      ? portalFundAccount(selected.id, parseFloat(amount), description || undefined)
      : portalDebitAccount(selected.id, parseFloat(amount), description || undefined),
    onSuccess: () => {
      toast({ title: `Account ${action === "fund" ? "funded" : "debited"} successfully` });
      qc.invalidateQueries({ queryKey: ["portal-accounts"] });
      setSelected(null); setAmount(""); setDescription("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (accounts as any[]).filter((a) => {
    const name = customerById.get(a.customerId) ?? "";
    return `${a.accountNumber} ${name}`.toLowerCase().includes(search.toLowerCase());
  });

  const statusColor: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    frozen: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    closed: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" /> Accounts
          </h1>
          <p className="text-slate-400 text-sm mt-1">{accounts.length} customer accounts</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by account number or customer..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Account Number</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Balance</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Currency</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-slate-700/40 rounded animate-pulse" /></td></tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-500">No accounts found</td></tr>
                ) : filtered.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{a.accountNumber}</td>
                    <td className="px-4 py-3 text-white">{customerById.get(a.customerId) ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{a.bankingRegion === "EUROPE" ? "Europe" : a.bankingRegion ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{a.accountType?.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-white font-semibold">{Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-slate-400">{a.currency}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[a.status] ?? ""}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelected(a); setAction("fund"); }}
                          className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors" title="Fund">
                          <PlusCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelected(a); setAction("debit"); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Debit">
                          <MinusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{action === "fund" ? "Fund" : "Debit"} Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Account {selected?.accountNumber} · Balance: {selected ? Number(selected.balance).toFixed(2) : ""} {selected?.currency}
            </p>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Amount ({selected?.currency})</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01"
                placeholder="0.00" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Description (optional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={() => actionMutation.mutate()} disabled={actionMutation.isPending || !amount || parseFloat(amount) <= 0}
              className={action === "fund" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
              Confirm {action === "fund" ? "Fund" : "Debit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
