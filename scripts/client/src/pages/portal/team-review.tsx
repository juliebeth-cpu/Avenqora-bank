import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Clock3, FileCheck2, Search, X, XCircle } from "lucide-react";
import PortalLayout from "@/components/layout/portal-layout";
import { usePortalAuth } from "@/lib/portal-auth";
import { makeTheme } from "@/lib/make-theme";
import { portalListInformationChangeRequests, portalReviewInformationChangeRequest } from "@/lib/portal-api";

interface Props { params: { websiteUid: string } }
type ReviewStatus = "waiting_team_review" | "approved" | "rejected";

const statusLabels: Record<ReviewStatus, string> = {
  waiting_team_review: "Waiting for Team Review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function TeamReviewPage({ params }: Props) {
  const { admin } = usePortalAuth();
  const theme = makeTheme(admin?.primaryColor ?? "#1a56db");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewStatus>("waiting_team_review");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const { data: requests = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["portal-information-change-requests", filter],
    queryFn: () => portalListInformationChangeRequests(filter),
    enabled: admin?.capabilities?.teamReview === true,
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      portalReviewInformationChangeRequest(id, { status, decisionReason: decisionReason.trim() || undefined }),
    onSuccess: () => {
      setSelectedId(null);
      setDecisionReason("");
      queryClient.invalidateQueries({ queryKey: ["portal-information-change-requests"] });
    },
  });

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      `${request.customer?.name ?? ""} ${request.customer?.email ?? ""} ${request.fieldLabel ?? ""} ${request.reason ?? ""}`.toLowerCase().includes(term),
    );
  }, [requests, search]);

  if (!admin) return null;
  if (admin.capabilities?.teamReview !== true) {
    return <PortalLayout><div className="p-8 text-slate-400">Team Review is not available for this website.</div></PortalLayout>;
  }

  const selected = requests.find((request) => request.id === selectedId);
  const canReview = admin.role === "admin" || admin.role === "support";

  return (
    <PortalLayout>
      <div className="p-5 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: theme.accent }}>Operations</p>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">Team Review</h1>
            <p className="text-slate-400 text-sm mt-2">Review customer requests to correct protected registration and KYC information.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCheck2 className="w-4 h-4" /> {canReview ? "Review access enabled" : "View only"}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, field, or reason" className="w-full h-10 rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-slate-600" />
          </div>
          <div className="flex rounded-lg border border-white/10 p-1 bg-white/[0.02]">
            {(["waiting_team_review", "approved", "rejected"] as ReviewStatus[]).map((status) => (
              <button key={status} onClick={() => setFilter(status)} className={`px-3 py-1.5 rounded-md text-xs transition-colors ${filter === status ? "text-white" : "text-slate-500 hover:text-slate-300"}`} style={filter === status ? { background: theme.accent } : undefined}>
                {status === "waiting_team_review" ? "Pending" : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{(error as Error).message}</div>}
        {isLoading ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center text-slate-500">Loading Team Review requests…</div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <Clock3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300">No {filter === "waiting_team_review" ? "pending" : filter} requests.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <button key={request.id} onClick={() => { setSelectedId(request.id); setDecisionReason(""); }} className={`w-full text-left rounded-xl border p-4 transition-colors ${selectedId === request.id ? "border-white/30 bg-white/[0.07]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{request.customer?.name ?? "Unknown customer"}</p>
                      <p className="text-slate-500 text-xs mt-1">{request.customer?.email} · {request.fieldLabel}</p>
                    </div>
                    <span className={`text-xs ${request.status === "approved" ? "text-emerald-400" : request.status === "rejected" ? "text-red-400" : "text-amber-400"}`}>{statusLabels[request.status as ReviewStatus]}</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-3 line-clamp-2">{request.reason}</p>
                  <p className="text-slate-600 text-xs mt-3">{new Date(request.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 h-fit lg:sticky lg:top-4">
              {!selected ? (
                <div className="text-center py-10 text-slate-500"><FileCheck2 className="w-8 h-8 mx-auto mb-3 text-slate-600" /><p>Select a request to review.</p></div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">Request detail</p>
                    <h2 className="text-lg font-semibold text-white mt-1">{selected.fieldLabel}</h2>
                    <p className="text-sm text-slate-400 mt-1">{selected.customer?.name} · {selected.customer?.email}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-lg bg-black/20 p-3"><p className="text-xs text-slate-500">Current value</p><p className="text-sm text-slate-300 mt-1">{selected.currentValue ?? "Not provided"}</p></div>
                    <div className="rounded-lg bg-black/20 p-3"><p className="text-xs text-slate-500">Requested value</p><p className="text-sm text-slate-300 mt-1">{selected.requestedValue ?? "Not provided"}</p></div>
                  </div>
                  <div><p className="text-xs text-slate-500">Customer reason</p><p className="text-sm text-slate-300 mt-1">{selected.reason}</p></div>
                  {selected.status === "waiting_team_review" && (
                    <>
                      <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={3} placeholder={canReview ? "Optional approval note; required when rejecting" : "Viewer accounts cannot decide requests"} disabled={!canReview || reviewMutation.isPending} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-50" />
                      {reviewMutation.isError && <p className="text-sm text-red-400">{(reviewMutation.error as Error).message}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={!canReview || reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: selected.id, status: "approved" })} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Check className="w-4 h-4" />Approve</button>
                        <button disabled={!canReview || reviewMutation.isPending || !decisionReason.trim()} onClick={() => reviewMutation.mutate({ id: selected.id, status: "rejected" })} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600/80 hover:bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><X className="w-4 h-4" />Reject</button>
                      </div>
                    </>
                  )}
                  {selected.status !== "waiting_team_review" && <p className="text-sm text-slate-400">This request has already been decided.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}