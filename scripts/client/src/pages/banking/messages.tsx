import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useBankingAuth } from "@/lib/banking-auth";
import { bankingListSupportMessages, bankingSendSupportMessage } from "@/lib/banking-api";
import { formatBankingDateTime, getBankingRegionalConfig } from "@/lib/banking-region";
import { AlertCircle, MessageCircle, Send } from "lucide-react";

interface Props { params: { websiteUid: string } }

export default function BankingMessagesPage({ params }: Props) {
  const { websiteUid } = params;
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const isEurope = regional.region === "EUROPE";

  const messagesQuery = useQuery({
    queryKey: ["banking-support-messages"],
    queryFn: bankingListSupportMessages,
    enabled: isEurope,
    refetchInterval: isEurope ? 20_000 : false,
  });
  const sendMutation = useMutation({
    mutationFn: bankingSendSupportMessage,
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["banking-support-messages"] });
      toast({ title: "Message sent" });
    },
    onError: (error: any) => toast({ title: "Could not send message", description: error.message, variant: "destructive" }),
  });

  if (!isEurope) {
    return (
      <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
        <div className="mx-auto max-w-xl rounded-2xl border bank-surface p-6">
          <AlertCircle className="bank-muted h-6 w-6" />
          <h1 className="bank-title mt-3 text-lg font-semibold">Messages unavailable</h1>
          <p className="bank-muted mt-1 text-sm">Customer service messages are available for Europe-region banking accounts.</p>
        </div>
      </CustomerBankingLayout>
    );
  }

  const messages = messagesQuery.data ?? [];

  return (
    <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
      <div className="mx-auto max-w-3xl space-y-5" data-testid="banking-support-messages">
        <header>
          <h1 className="bank-title flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="bank-accent h-6 w-6" /> Customer service
          </h1>
          <p className="bank-muted mt-1 text-sm">Send a secure message to your banking website administrator.</p>
        </header>

        <div className="flex gap-3 rounded-2xl border border-sky-300/50 bg-sky-50 p-4 text-sky-950">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-relaxed">Messages stay within this banking website. Do not include passwords, PINs, or card security codes.</p>
        </div>

        <section className="bank-surface overflow-hidden rounded-2xl border" aria-label="Message history">
          <div className="border-b border-[var(--bank-line)] px-4 py-3">
            <h2 className="bank-title text-sm font-semibold">Conversation</h2>
          </div>
          <div className="max-h-[55vh] min-h-44 space-y-3 overflow-y-auto p-4">
            {messagesQuery.isLoading ? (
              <p className="bank-muted py-8 text-center text-sm">Loading messages…</p>
            ) : messagesQuery.isError ? (
              <p className="py-8 text-center text-sm text-rose-700">Messages could not be loaded. Try refreshing the page.</p>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center">
                <MessageCircle className="bank-muted mx-auto h-7 w-7" />
                <p className="bank-muted mt-2 text-sm">No messages yet. Send a message to start the conversation.</p>
              </div>
            ) : messages.map((message: any) => {
              const isCustomer = message.senderType === "customer";
              return (
                <div key={message.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                  <article className={`max-w-[88%] rounded-2xl px-4 py-3 ${isCustomer ? "bg-sky-700 text-white" : "bg-[var(--bank-surface-soft)] bank-title"}`}>
                    <div className="flex items-center justify-between gap-6">
                      <p className={`text-xs font-semibold ${isCustomer ? "text-sky-100" : "bank-accent"}`}>
                        {isCustomer ? "You" : "Customer service"}
                      </p>
                      <time className={`text-[10px] ${isCustomer ? "text-sky-100/80" : "bank-muted"}`}>
                        {formatBankingDateTime(message.createdAt, regional)}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                  </article>
                </div>
              );
            })}
          </div>
        </section>

        <form
          className="bank-surface space-y-3 rounded-2xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = body.trim();
            if (trimmed) sendMutation.mutate({ body: trimmed });
          }}
        >
          <label htmlFor="banking-message-body" className="bank-title block text-sm font-medium">Your message</label>
          <Textarea
            id="banking-message-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="How can the banking team help?"
            className="bank-title resize-y border-[var(--bank-line)] bg-[var(--bank-surface)]"
            required
          />
          <div className="flex items-center justify-between gap-3">
            <span className="bank-muted text-xs">{body.length}/4000</span>
            <Button type="submit" disabled={sendMutation.isPending || !body.trim()} className="bank-primary rounded-xl text-white">
              <Send className="mr-2 h-4 w-4" /> {sendMutation.isPending ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      </div>
    </CustomerBankingLayout>
  );
}
