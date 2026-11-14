import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import ForexAdminLayout from "@/components/layout/forex-admin-layout";
import { usePortalAuth } from "@/lib/portal-auth";
import { portalListKyc, portalReviewKyc } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Search, ExternalLink } from "lucide-react";
import { buildReceiptUrl } from "@/lib/receipt-url";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  more_info_requested: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

interface Props { variant?: "banking" | "forex" }

export default function BankingKycPage({ variant = "banking" }: Props) {
  const { admin } = usePortalAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("approved");
  const [notes, setNotes] = useState("");

  const { data: submissions = [], isLoading } = useQuery({ queryKey: ["portal-kyc"], queryFn: portalListKyc });

  const reviewMutation = useMutation({
    mutationFn: () => portalReviewKyc(selected.id, newStatus, notes || undefined),
    onSuccess: () => {
      toast({ title: "KYC updated" });
      qc.invalidateQueries({ queryKey: ["portal-kyc"] });
      setSelected(null); setNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = submissions.filter((k: any) =>
    `${k.customerName ?? ""} ${k.fullName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const content = (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-blue-400" /> KYC Submissions
          </h1>
          <p className="text-slate-400 text-sm mt-1">{submissions.length} submissions</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by customer or name..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                  {variant === "banking" && <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>}
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Full Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Document</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Submitted</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={variant === "banking" ? 7 : 6} className="px-4 py-3"><div className="h-4 bg-slate-700/40 rounded animate-pulse" /></td></tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={variant === "banking" ? 7 : 6} className="text-center py-8 text-slate-500">No KYC submissions found</td></tr>
                ) : filtered.map((k: any) => (
                  <tr key={k.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-300">{k.customerName ?? "—"}</td>
                    {variant === "banking" && <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{k.bankingRegion === "EUROPE" ? "Europe" : k.bankingRegion ?? "—"}</td>}
                    <td className="px-4 py-3 text-white">{k.fullName}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{k.documentType?.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[k.status] ?? ""}`}>
                        {k.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(k.submittedAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setSelected(k); setNewStatus("approved"); }}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader><DialogTitle>Review KYC — {selected?.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Document:</span> <span className="text-slate-300 capitalize">{selected?.documentType?.replace("_", " ")}</span></div>
              {selected?.documentNumber && <div><span className="text-slate-500">Number:</span> <span className="text-slate-300">{selected.documentNumber}</span></div>}
              {selected?.dateOfBirth && <div><span className="text-slate-500">DOB:</span> <span className="text-slate-300">{selected.dateOfBirth}</span></div>}
              {selected?.address && <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="text-slate-300">{selected.address}</span></div>}
            </div>
            <div className="flex gap-2">
              {selected?.documentFrontUrl && <a href={buildReceiptUrl(selected.documentFrontUrl)!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><ExternalLink className="w-3 h-3" /> Front</a>}
              {selected?.documentBackUrl && <a href={buildReceiptUrl(selected.documentBackUrl)!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><ExternalLink className="w-3 h-3" /> Back</a>}
              {selected?.selfieUrl && <a href={buildReceiptUrl(selected.selfieUrl)!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><ExternalLink className="w-3 h-3" /> Selfie</a>}
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Decision</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                  <SelectItem value="more_info_requested">Request More Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes..."
              rows={2} className="bg-slate-800 border-slate-700 text-white resize-none" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white">Submit Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return variant === "forex"
    ? <ForexAdminLayout websiteUid={admin?.websiteUid ?? ""}>{content}</ForexAdminLayout>
    : <PortalLayout>{content}</PortalLayout>;
}
