import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingListCards, bankingSubmitCard } from "@/lib/banking-api";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus } from "lucide-react";

const schema = z.object({
  cardNumber: z.string().min(16, "Enter 16-digit card number").max(19),
  cardHolderName: z.string().min(1, "Card holder name required"),
  expiryMonth: z.string().min(1, "Required"),
  expiryYear: z.string().min(1, "Required"),
  cvv: z.string().min(3, "CVV required").max(4),
  billingAddress: z.string().optional(),
  cardBrand: z.enum(["visa", "mastercard", "amex", "discover", "other"]).default("visa"),
});

interface Props { params: { websiteUid: string } }

const statusColor: Record<string, string> = {
  pending: "text-yellow-400", approved: "text-green-400", declined: "text-red-400",
};

export default function BankingCardsPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["banking-cards"],
    queryFn: bankingListCards,
    refetchInterval: 15_000,
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { cardNumber: "", cardHolderName: "", expiryMonth: "", expiryYear: "", cvv: "", billingAddress: "", cardBrand: "visa" },
  });

  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => bankingSubmitCard(v),
    onSuccess: () => {
      toast({ title: "Card submitted for review" });
      qc.invalidateQueries({ queryKey: ["banking-cards"] });
      setShowForm(false);
      form.reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear + i));

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CreditCard className="w-6 h-6 text-blue-400" /> Bank Cards</h1>
            <p className="text-slate-400 text-sm mt-1">Link your payment cards</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9">
              <Plus className="w-4 h-4" /> Add Card
            </Button>
          )}
        </div>

        {/* Existing cards */}
        {!isLoading && (cards as any[]).length > 0 && (
          <div className="space-y-3">
            {(cards as any[]).map((card: any) => (
              <div key={card.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium capitalize">{card.cardBrand} •••• {card.lastFourDigits}</p>
                    <p className="text-slate-400 text-sm">{card.cardHolderName} · {card.expiryMonth}/{card.expiryYear}</p>
                  </div>
                   <span data-testid={`status-card-${card.id}`} className={`text-sm font-medium ${statusColor[card.status] ?? "text-slate-400"}`}>
                    {card.status}
                  </span>
                </div>
                {card.status === "declined" && card.declineReason && (
                  <p className="text-red-400 text-xs mt-2">Reason: {card.declineReason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {(cards as any[]).length === 0 && !showForm && !isLoading && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-8 text-center">
            <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No cards linked yet</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Add Your First Card
            </Button>
          </div>
        )}

        {/* Add card form */}
        {showForm && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Add New Card</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="cardBrand" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Card Brand</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {["visa","mastercard","amex","discover","other"].map((b) => <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>)}
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="cardNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Card Number</FormLabel>
                    <FormControl><Input placeholder="0000 0000 0000 0000" maxLength={19}
                      className="bg-slate-900/60 border-slate-700 text-white h-11 font-mono tracking-widest" {...field}
                      onChange={(e) => field.onChange(e.target.value.replace(/\s/g, ""))} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cardHolderName" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Card Holder Name</FormLabel>
                    <FormControl><Input placeholder="Name as on card" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="expiryMonth" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-300">Month</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue placeholder="MM" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-slate-900 border-slate-700">{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="expiryYear" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-300">Year</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue placeholder="YYYY" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-slate-900 border-slate-700">{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cvv" render={({ field }) => (
                    <FormItem><FormLabel className="text-slate-300">CVV</FormLabel>
                      <FormControl><Input placeholder="•••" maxLength={4} className="bg-slate-900/60 border-slate-700 text-white h-11 font-mono" {...field} /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="billingAddress" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Billing Address (optional)</FormLabel>
                    <FormControl><Input placeholder="123 Main St, City, Country" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1 border-slate-700 text-slate-300 h-11">Cancel</Button>
                  <Button type="submit" disabled={mutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-11">
                    {mutation.isPending ? "Submitting..." : "Submit Card"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </CustomerBankingLayout>
  );
}
