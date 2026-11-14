import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  portalEmailSettings,
  portalUpdateEmailIdentity,
  portalUpdateNotificationTemplates,
  portalVerifyEmailIdentity,
} from "@/lib/portal-api";
import { CheckCircle2, Mail, Save, Send, ShieldCheck } from "lucide-react";

type IdentityName = "main_system" | "customer_support";

export default function PortalEmailSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["portal-email-settings"], queryFn: portalEmailSettings });
  const [drafts, setDrafts] = useState<Record<IdentityName, { address: string; senderName: string }> | null>(null);
  const settings = settingsQuery.data;
  const identity = (name: IdentityName) => drafts?.[name] ?? settings?.[name === "main_system" ? "mainSystem" : "customerSupport"] ?? { address: "", senderName: "" };

  const saveIdentity = useMutation({
    mutationFn: ({ name, values }: { name: IdentityName; values: { address: string; senderName: string } }) => portalUpdateEmailIdentity(name, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["portal-email-settings"] }); setDrafts(null); toast({ title: "Email identity saved" }); },
    onError: (error: Error) => toast({ title: "Could not save identity", description: error.message, variant: "destructive" }),
  });
  const verifyIdentity = useMutation({
    mutationFn: portalVerifyEmailIdentity,
    onSuccess: () => toast({ title: "Verification message sent" }),
    onError: (error: Error) => toast({ title: "Could not send verification", description: error.message, variant: "destructive" }),
  });
  const saveTemplates = useMutation({
    mutationFn: portalUpdateNotificationTemplates,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["portal-email-settings"] }); toast({ title: "Templates saved" }); },
    onError: (error: Error) => toast({ title: "Could not save templates", description: error.message, variant: "destructive" }),
  });

  if (settingsQuery.isLoading) return <PortalLayout><div className="p-8 text-slate-400">Loading email settings…</div></PortalLayout>;
  if (!settings) return <PortalLayout><div className="p-8 text-red-400">Email settings unavailable.</div></PortalLayout>;

  const updateDraft = (name: IdentityName, key: "address" | "senderName", value: string) => {
    const current = identity(name);
    setDrafts({ ...(drafts ?? { main_system: identity("main_system"), customer_support: identity("customer_support") }), [name]: { ...current, [key]: value } });
  };

  return <PortalLayout>
    <div className="max-w-5xl mx-auto p-6 space-y-8 text-white">
      <div><h1 className="text-2xl font-bold">Email identity & notifications</h1><p className="text-slate-400 mt-1">Each website has its own sender identities and notification templates.</p></div>
      <div className="grid gap-5 md:grid-cols-2">
        {(["main_system", "customer_support"] as IdentityName[]).map((name) => {
          const value = identity(name); const isMain = name === "main_system";
          return <section key={name} className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-blue-400" />{isMain ? "Main System Email" : "Customer Support Email"}</h2><p className="text-xs text-slate-400 mt-1">{isMain ? "Used only for automated system notifications." : "Used only for customer inquiries."}</p></div>{value.verified && <span className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Verified</span>}</div>
            <Input value={value.address ?? ""} onChange={(event) => updateDraft(name, "address", event.target.value)} placeholder="email@example.com" className="bg-slate-950/60 border-slate-700 text-white" />
            <Input value={value.senderName ?? ""} onChange={(event) => updateDraft(name, "senderName", event.target.value)} placeholder="Sender name" className="bg-slate-950/60 border-slate-700 text-white" />
            <div className="flex gap-2"><Button onClick={() => saveIdentity.mutate({ name, values: value })} disabled={!value.address || !value.senderName || saveIdentity.isPending}><Save className="w-4 h-4 mr-2" />Save</Button><Button variant="outline" onClick={() => verifyIdentity.mutate(name)} disabled={!value.address || verifyIdentity.isPending}><Send className="w-4 h-4 mr-2" />Verify</Button></div>
          </section>;
        })}
      </div>
      <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
        <div><h2 className="font-semibold">Automated notification templates</h2><p className="text-xs text-slate-400 mt-1">Disable individual messages or customize their subject, title, and body.</p></div>
        <div className="space-y-4">{Object.entries(settings.templates).map(([event, template]: [string, any]) => <div key={event} className="border-t border-white/10 pt-4 grid gap-3 md:grid-cols-[180px_1fr_auto] items-start"><div className="text-sm font-medium capitalize">{event.replaceAll("_", " ")}</div><div className="space-y-2"><Input value={template.subject} onChange={(e) => { settings.templates[event].subject = e.target.value; queryClient.setQueryData(["portal-email-settings"], { ...settings }); }} className="bg-slate-950/60 border-slate-700 text-white" /><Input value={template.message} onChange={(e) => { settings.templates[event].message = e.target.value; queryClient.setQueryData(["portal-email-settings"], { ...settings }); }} className="bg-slate-950/60 border-slate-700 text-white" /></div><Switch checked={template.enabled} onCheckedChange={(enabled) => { settings.templates[event].enabled = enabled; queryClient.setQueryData(["portal-email-settings"], { ...settings }); }} /></div>)}</div>
        <Button onClick={() => saveTemplates.mutate(settings.templates)} disabled={saveTemplates.isPending}><CheckCircle2 className="w-4 h-4 mr-2" />Save templates</Button>
      </section>
    </div>
  </PortalLayout>;
}