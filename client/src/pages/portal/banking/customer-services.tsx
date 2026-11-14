import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  portalListBankingCustomerActions,
  portalListBankingMessages,
  portalReplyBankingMessage,
  portalReviewBankingCustomerAction,
} from "@/lib/portal-api";
import { AlertCircle, Check, Clock3, MessageCircle, RefreshCcw, X } from "lucide-react";

const STATUS: Record<string, { label: string; classes: string }> = {
  pending: { label: "Pending review", classes: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
  approved: { label: "Approved", classes: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Declined", classes: "border-rose-500/30 bg-rose-500/15 text-rose-300" },
  refunded: { label: "Refunded", classes: "border-slate-500/30 bg-slate-500/15 text-slate-300" },
};

export default function BankingCustomerServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [reply, setReply] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const actionsQuery = useQuery({
    queryKey: ["portal-banking-customer-actions"],
    queryFn: portalListBankingCustomerActions,
    refetchInterval: 30_000,
  });
  const messagesQuery = useQuery({
    queryKey: ["portal-banking-customer-messages"],
    queryFn: portalListBankingMessages,
    refetchInterval: 20_000,
  });

  const actions = actionsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const threads = useMemo(() => {
    const byCustomer = new Map<number, any[]>();
    for (const message of messages) {
      const list = byCustomer.get(message.customerId) ?? [];
      list.push(message);
      byCustomer.set(message.customerId, list);
    }
    return [...byCustomer.entries()].map(([customerId, thread]) => ({
      customerId,
      customerName: thread[0]?.customerName ?? "Customer",
      messages: thread,
    }));
  }, [messages]);
  useEffect(() => {
    if (!selectedCustomerId && threads.length) setSelectedCustomerId(String(threads[0].customerId));
    else if (selectedCustomerId && !threads.some((thread: any) => String(thread.customerId) === selectedCustomerId)) {
      setSelectedCustomerId(threads.length ? String(threads[0].customerId) : "");
    }
  }, [selectedCustomerId, threads]);
  const selectedThread = threads.find((thread: any) => String(thread.customerId) === selectedCustomerId);
  const pendingCount = actions.filter((action: any) => action.status === "pending").length;

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) =>
      portalReviewBankingCustomerAction(id, status, adminNotes),
    onSuccess: async (_, variables) => {
      toast({ title: variables.status === "approved" ? "Request approved" : variables.status === "rejected" ? "Request declined" : "Request refunded" });
      setNotesById((current) => ({ ...current, [variables.id]: "" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["portal-banking-customer-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["portal-transfers"] }),
      ]);
    },
    onError: (error: any) => toast({ title: "Could not update request", description: error.message, variant: "destructive" }),
  });
  const replyMutation = useMutation({
    mutationFn: ({ customerId, body }: { customerId: number; body: string }) => portalReplyBankingMessage(customerId, body),
    onSuccess: async () => {
      setReply("");
      toast({ title: "Reply sent" });
      await queryClient.invalidateQueries({ queryKey: ["portal-banking-customer-messages"] });
    },
    onError: (error: any) => toast({ title: "Could not send reply", description: error.message, variant: "destructive" }),
  });

  function review(action: any, status: "approved" | "rejected" | "refunded") {
    const note = (notesById[action.id] ?? "").trim();
    if ((status === "rejected" || status === "refunded") && !note) {
      toast({ title: status === "rejected" ? "Add a decline reason" : "Add a refund reason", variant: "destructive" });
      return;
    }
    reviewMutation.mutate({ id: action.id, status, adminNotes: note || undefined });
  }

  return (
    <PortalLayout>
      <div className="mx-auto max-w-[1450px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <MessageCircle className="h-6 w-6 text-sky-400" /> Customer actions & messages
            </h1>
            <p className="mt-1 text-sm text-slate-400">Payment requests and Europe-region customer service conversations.</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <Clock3 className="mr-2 inline h-4 w-4" /> {pendingCount} pending review
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4" aria-labelledby="customer-actions-title">
            <div className="flex items-center justify-between">
              <h2 id="customer-actions-title" className="text-lg font-semibold text-white">Payment requests</h2>
              <span className="text-xs text-slate-400">{actions.length} total</span>
            </div>
            {actionsQuery.isLoading ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-sm text-slate-400">Loading requests…</div>
            ) : actionsQuery.isError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">Requests could not be loaded.</div>
            ) : actions.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">No payment requests in this region.</p>
              </div>
            ) : actions.map((action: any) => {
              const status = STATUS[action.status] ?? STATUS.pending;
              const note = notesById[action.id] ?? "";
              return (
                <article key={action.id} className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold capitalize text-white">{action.actionType.replaceAll("_", " ")}</h3>
                      <p className="mt-1 text-xs text-slate-400">{action.customerName ?? "Customer"} · {action.bankingRegion ?? "Banking"}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{action.reference}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{action.currency} {Number(action.amount).toFixed(2)}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-x-4 gap-y-2 rounded-xl bg-slate-900/50 p-3 text-xs sm:grid-cols-2">
                    {Object.entries(action.details ?? {}).map(([key, value]) => (
                      <p key={key} className="break-words text-slate-300"><span className="capitalize text-slate-500">{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}:</span> {String(value)}</p>
                    ))}
                    {action.accountLabel && <p className="text-slate-300"><span className="text-slate-500">From account:</span> {action.accountLabel}</p>}
                    {action.dueAt && <p className="text-slate-300"><span className="text-slate-500">Due:</span> {new Date(action.dueAt).toLocaleDateString()}</p>}
                  </div>
                  {action.adminNotes && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-300">Admin note: {action.adminNotes}</p>}
                  {action.status === "pending" ? (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={note}
                        onChange={(event) => setNotesById((current) => ({ ...current, [action.id]: event.target.value }))}
                        placeholder="Optional approval note; required for a decline."
                        maxLength={1000}
                        rows={2}
                        className="border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-500"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => review(action, "rejected")}
                          className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                        >
                          <X className="mr-1.5 h-4 w-4" /> Decline
                        </Button>
                        <Button
                          disabled={reviewMutation.isPending}
                          onClick={() => review(action, "approved")}
                          className="bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          <Check className="mr-1.5 h-4 w-4" /> Approve internally
                        </Button>
                      </div>
                    </div>
                  ) : action.status === "approved" ? (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={note}
                        onChange={(event) => setNotesById((current) => ({ ...current, [action.id]: event.target.value }))}
                        placeholder="Required reason for refund."
                        maxLength={1000}
                        rows={2}
                        className="border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-500"
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => review(action, "refunded")}
                          className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        >
                          <RefreshCcw className="mr-1.5 h-4 w-4" /> Refund to internal balance
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>

          <section className="space-y-4" aria-labelledby="banking-messages-title">
            <div className="flex items-center justify-between">
              <h2 id="banking-messages-title" className="text-lg font-semibold text-white">Customer messages</h2>
              <span className="text-xs text-slate-400">Europe region</span>
            </div>
            {messagesQuery.isLoading ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-sm text-slate-400">Loading conversations…</div>
            ) : messagesQuery.isError ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">Messages could not be loaded.</div>
            ) : threads.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center">
                <MessageCircle className="mx-auto h-6 w-6 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">No Europe-region customer conversations yet.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/40">
                <div className="border-b border-slate-700 p-3">
                  <label htmlFor="banking-message-customer" className="mb-1.5 block text-xs font-medium text-slate-400">Conversation</label>
                  <select
                    id="banking-message-customer"
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {threads.map((thread: any) => <option key={thread.customerId} value={String(thread.customerId)}>{thread.customerName}</option>)}
                  </select>
                </div>
                <div className="max-h-[430px] min-h-48 space-y-3 overflow-y-auto p-4">
                  {selectedThread?.messages.map((message: any) => {
                    const isAdmin = message.senderType === "website_admin";
                    return (
                      <div key={message.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <article className={`max-w-[90%] rounded-xl px-3 py-2.5 ${isAdmin ? "bg-sky-700 text-white" : "bg-slate-900 text-slate-200"}`}>
                          <p className={`text-[10px] font-semibold ${isAdmin ? "text-sky-100" : "text-slate-400"}`}>{isAdmin ? "Bank team" : selectedThread.customerName}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                          <p className={`mt-2 text-right text-[10px] ${isAdmin ? "text-sky-100/70" : "text-slate-500"}`}>{new Date(message.createdAt).toLocaleString()}</p>
                        </article>
                      </div>
                    );
                  })}
                </div>
                <form
                  className="space-y-3 border-t border-slate-700 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selectedThread && reply.trim()) replyMutation.mutate({ customerId: selectedThread.customerId, body: reply.trim() });
                  }}
                >
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={3}
                    maxLength={4000}
                    required
                    placeholder="Write a reply…"
                    className="border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{reply.length}/4000</span>
                    <Button type="submit" disabled={replyMutation.isPending || !reply.trim()} className="bg-sky-600 text-white hover:bg-sky-500">
                      {replyMutation.isPending ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </PortalLayout>
  );
}
