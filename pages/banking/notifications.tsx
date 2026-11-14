import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingListNotifications, bankingMarkNotificationRead, bankingMarkAllRead } from "@/lib/banking-api";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingDate, getBankingRegionalConfig } from "@/lib/banking-region";

interface Props { params: { websiteUid: string } }

const typeColor: Record<string, string> = {
  success: "border-l-green-500", error: "border-l-red-500", warning: "border-l-yellow-500",
  info: "border-l-blue-500", transaction: "border-l-purple-500",
};

export default function BankingNotificationsPage({ params }: Props) {
  const { websiteUid } = params;
  const qc = useQueryClient();
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["banking-notifications"], queryFn: bankingListNotifications,
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => bankingMarkNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banking-notifications", "banking-dashboard"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: bankingMarkAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banking-notifications", "banking-dashboard"] }),
  });

  const unread = (notifications as any[]).filter((n) => !n.read).length;

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-400" /> Notifications
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {unread > 0 ? `${unread} unread` : "All caught up"} · {(notifications as any[]).length} total
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" onClick={() => readAllMutation.mutate()} disabled={readAllMutation.isPending}
              className="border-slate-700 text-slate-300 hover:text-white gap-2 h-9">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800/60 rounded-xl" />)}
          </div>
        ) : (notifications as any[]).length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-12 text-center">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(notifications as any[]).map((n: any) => (
              <div key={n.id} onClick={() => !n.read && readMutation.mutate(n.id)}
                className={cn(
                  "bg-slate-800/60 border border-slate-700/60 border-l-4 rounded-xl p-4 cursor-pointer transition-colors hover:bg-slate-700/40",
                  typeColor[n.type] ?? "border-l-slate-600",
                  !n.read && "bg-slate-800",
                )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", n.read ? "text-slate-400" : "text-white")}>{n.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                    <p className="text-slate-500 text-xs whitespace-nowrap">{formatBankingDate(n.createdAt, regional, { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerBankingLayout>
  );
}
