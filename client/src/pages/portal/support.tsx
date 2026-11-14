/**
 * Portal – Customer Support Settings
 *
 * Two sections:
 *  1. Live Chat Widget   — managed via websites.live_chat_code/enabled/status
 *     • Provider templates (Smartsupp, Tawk.to, Crisp, Intercom, Zendesk, LiveChat, Custom)
 *     • Server-side validation with inline error display
 *     • Status badges: ✅ Accepted and Connected | ⚠ Waiting for Connection
 *                      ❌ Failed to Load | ❌ Declined – Invalid Script | ⚪ Disabled
 *     • Emergency disable toggle (keeps saved code intact)
 *     • Configuration history (audit log)
 *  2. Support Channels  — WhatsApp, email, phone, etc.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  portalGetLiveChatWidget, portalUpdateLiveChatWidget, portalGetLiveChatAudit,
  portalListChannels, portalCreateChannel, portalUpdateChannel, portalDeleteChannel,
} from "@/lib/portal-api";
import {
  Plus, Edit2, Trash2, HeadphonesIcon, MessageCircle, Mail, Phone,
  Globe, MessageSquare, Zap, CheckCircle2, XCircle, AlertCircle,
  Clock, ChevronDown, ChevronRight, History,
} from "lucide-react";

// ─── Live Chat Provider Templates ─────────────────────────────────────────────

type ProviderField = { key: string; label: string; placeholder: string };
type Provider = {
  id: string; name: string; description: string;
  fields: ProviderField[];
  generate:      (cfg: Record<string, string>) => string;
  detect:        (code: string) => boolean;
  extractFields: (code: string) => Record<string, string>;
};

const PROVIDERS: Provider[] = [
  {
    id: "smartsupp", name: "Smartsupp",
    description: "Live chat, chatbots & video recordings",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "e.g. a1b2c3d4e5f6..." }],
    generate: (c) => `<script type="text/javascript">
var _smartsupp = _smartsupp || {};
_smartsupp.key = '${c.apiKey}';
window.smartsupp||(function(d) {
  var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
  s=d.getElementsByTagName('script')[0];c=d.createElement('script');
  c.type='text/javascript';c.charset='utf-8';c.async=!0;
  c.src='https://www.smartsuppchat.com/loader.js?'+_smartsupp.key;
  s.parentNode.insertBefore(c,s);
})(document);
</script>`,
    detect: (c) => c.includes("smartsuppchat.com") || c.includes("smartsupp.com") || c.includes("_smartsupp"),
    extractFields: (c): Record<string, string> => { const m = c.match(/_smartsupp\.key\s*=\s*['"]([^'"]+)['"]/); return m ? { apiKey: m[1] ?? "" } : {}; },
  },
  {
    id: "tawk_to", name: "Tawk.to",
    description: "Free live chat & messaging platform",
    fields: [
      { key: "propertyId", label: "Property ID", placeholder: "e.g. 63abc1234567890abc123456" },
      { key: "widgetId",   label: "Widget ID",   placeholder: "e.g. 1h2i3j4k5 (or leave blank)" },
    ],
    generate: (c) => `<script type="text/javascript">
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
  var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
  s1.async=true;
  s1.src='https://embed.tawk.to/${c.propertyId}/${c.widgetId || "default"}';
  s1.charset='UTF-8';
  s1.setAttribute('crossorigin','*');
  s0.parentNode.insertBefore(s1,s0);
})();
</script>`,
    detect: (c) => c.includes("embed.tawk.to") || c.includes("Tawk_API"),
    extractFields: (c): Record<string, string> => {
      const m = c.match(/embed\.tawk\.to\/([^\/'">\s]+)\/([^'">\s]+)/);
      return m ? { propertyId: m[1] ?? "", widgetId: (m[2] ?? "") === "default" ? "" : m[2] ?? "" } : {};
    },
  },
  {
    id: "crisp", name: "Crisp",
    description: "Business messaging platform",
    fields: [{ key: "websiteId", label: "Website ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }],
    generate: (c) => `<script type="text/javascript">
window.$crisp=[];window.CRISP_WEBSITE_ID="${c.websiteId}";
(function(){
  d=document;s=d.createElement("script");
  s.src="https://client.crisp.chat/l.js";
  s.async=1;d.getElementsByTagName("head")[0].appendChild(s);
})();
</script>`,
    detect: (c) => c.includes("crisp.chat") || c.includes("CRISP_WEBSITE_ID"),
    extractFields: (c): Record<string, string> => { const m = c.match(/CRISP_WEBSITE_ID\s*[=:]\s*["']([^"']+)["']/); return m ? { websiteId: m[1] ?? "" } : {}; },
  },
  {
    id: "intercom", name: "Intercom",
    description: "Customer service & engagement platform",
    fields: [{ key: "appId", label: "App ID", placeholder: "e.g. abcdef12" }],
    generate: (c) => `<script type="text/javascript">
window.intercomSettings = { api_base: "https://api-iam.intercom.io", app_id: "${c.appId}" };
(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${c.appId}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}};})();
</script>`,
    detect: (c) => c.includes("intercom.io") || c.includes("intercomSettings"),
    extractFields: (c): Record<string, string> => { const m = c.match(/app_id:\s*["']([^"']+)["']/); return m ? { appId: m[1] ?? "" } : {}; },
  },
  {
    id: "zendesk", name: "Zendesk Chat",
    description: "Enterprise customer support & chat",
    fields: [{ key: "accountKey", label: "Account Key", placeholder: "e.g. your-key-here" }],
    generate: (c) => `<script id="ze-snippet" src="https://static.zdassets.com/ekr/snippet.js?key=${c.accountKey}"></script>`,
    detect: (c) => c.includes("zdassets.com"),
    extractFields: (c): Record<string, string> => { const m = c.match(/snippet\.js\?key=([^\s'"&>]+)/); return m ? { accountKey: m[1] ?? "" } : {}; },
  },
  {
    id: "livechat", name: "LiveChat",
    description: "Live chat software for online sales",
    fields: [{ key: "licenseId", label: "License ID", placeholder: "e.g. 12345678" }],
    generate: (c) => `<script type="text/javascript">
window.__lc = window.__lc || {};
window.__lc.license = ${c.licenseId};
;(function(n,t,c){function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}var e={_q:[],_h:null,_v:"2.0",on:function(){i(["on",c.call(arguments)])},once:function(){i(["once",c.call(arguments)])},off:function(){i(["off",c.call(arguments)])},get:function(){if(!e._h)throw new Error("[LiveChatWidget] You can't use getters before load.");return i(["get",c.call(arguments)])},call:function(){i(["call",c.call(arguments)])},init:function(){var n=t.createElement("script");n.async=!0;n.type="text/javascript";n.src="https://cdn.livechatinc.com/tracking.js";t.head.appendChild(n)}};!n.__lc.asyncInit&&e.init();n.LiveChatWidget=n.LiveChatWidget||e}(window,document,[].slice))
</script>`,
    detect: (c) => c.includes("livechatinc.com") || c.includes("__lc.license"),
    extractFields: (c): Record<string, string> => { const m = c.match(/__lc\.license\s*=\s*(\d+)/); return m ? { licenseId: m[1] ?? "" } : {}; },
  },
  {
    id: "custom", name: "Custom Widget",
    description: "Any other JavaScript support widget",
    fields: [],
    generate: (c) => c.embedCode ?? "",
    detect:   ()  => false,
    extractFields: () => ({}),
  },
];

function detectProvider(code: string): Provider | null {
  if (!code?.trim()) return null;
  return PROVIDERS.find((p) => p.id !== "custom" && p.detect(code)) ?? PROVIDERS.find((p) => p.id === "custom")!;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type LiveChatStatus = "pending" | "active" | "failed" | "disabled" | null;

function StatusBadge({ status, enabled }: { status: LiveChatStatus; enabled: boolean }) {
  if (!enabled || status === "disabled") {
    return (
      <Badge className="bg-slate-600/40 text-slate-400 border-slate-600/60 text-xs gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Disabled
      </Badge>
    );
  }
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs gap-1">
          <CheckCircle2 className="w-3 h-3" /> Accepted and Connected
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
          <Clock className="w-3 h-3" /> Waiting for Connection
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs gap-1">
          <XCircle className="w-3 h-3" /> Failed to Load
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
          <Clock className="w-3 h-3" /> Waiting for Connection
        </Badge>
      );
  }
}

// ─── Audit event label ────────────────────────────────────────────────────────

const AUDIT_LABELS: Record<string, string> = {
  live_chat_configured:    "Widget configured",
  live_chat_rejected:      "Configuration rejected — invalid script",
  live_chat_enabled:       "Widget enabled",
  live_chat_disabled:      "Widget disabled",
  live_chat_removed:       "Widget removed",
  live_chat_status_update: "Browser status update",
  live_chat_widget_update: "Widget updated",
};

function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}

function auditIcon(action: string) {
  if (action.includes("rejected"))      return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (action.includes("removed"))       return <Trash2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (action.includes("enabled"))       return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
  if (action.includes("disabled"))      return <XCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
  if (action.includes("status_update")) return <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  return <History className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

// ─── Support channel types ────────────────────────────────────────────────────

const CHANNEL_TYPES = [
  { value: "whatsapp",    label: "WhatsApp",          fields: [{ key: "number", label: "Phone Number (intl)" }, { key: "prefilledMessage", label: "Pre-filled Message" }] },
  { value: "telegram",   label: "Telegram",           fields: [{ key: "username", label: "Username (without @)" }] },
  { value: "messenger",  label: "Facebook Messenger", fields: [{ key: "pageId", label: "Page ID" }] },
  { value: "instagram",  label: "Instagram",          fields: [{ key: "username", label: "Username" }] },
  { value: "twitter",    label: "X (Twitter)",        fields: [{ key: "username", label: "Username" }] },
  { value: "email",      label: "Email",              fields: [{ key: "address", label: "Email Address" }, { key: "subject", label: "Default Subject" }] },
  { value: "phone",      label: "Phone Number",       fields: [{ key: "number", label: "Phone Number" }] },
  { value: "live_chat",  label: "Live Chat (legacy)", fields: [{ key: "embedCode", label: "Embed Code" }] },
  { value: "custom_url", label: "Custom Support URL", fields: [{ key: "url", label: "URL" }, { key: "buttonText", label: "Button Text" }] },
];

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail, phone: Phone, whatsapp: MessageCircle, telegram: MessageCircle,
  messenger: MessageCircle, instagram: Globe, twitter: Globe,
};

const emptyForm = { channelType: "whatsapp", label: "", config: {} as Record<string, string>, isEnabled: true };

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function PortalSupportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Live Chat Widget ───────────────────────────────────────────────────────
  const { data: widgetData, isLoading: widgetLoading } = useQuery({
    queryKey: ["portal-live-chat-widget"],
    queryFn:  portalGetLiveChatWidget,
    refetchInterval: (query) => {
      // Poll every 5 s while status is 'pending' to pick up browser confirmation.
      return (query.state.data as any)?.liveChatStatus === "pending" ? 5000 : false;
    },
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery({
    queryKey: ["portal-live-chat-audit"],
    queryFn:  portalGetLiveChatAudit,
    enabled:  !!widgetData?.liveChatCode,
  });

  const [auditOpen, setAuditOpen] = useState(false);

  // Widget dialog state
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider]  = useState<Provider>(PROVIDERS[0]);
  const [providerFields, setProviderFields]      = useState<Record<string, string>>({});
  const [customCode, setCustomCode]              = useState("");
  const [widgetEnabled, setWidgetEnabled]        = useState(true);
  const [validationError, setValidationError]    = useState<string | null>(null);

  const openWidgetDialog = () => {
    const code    = widgetData?.liveChatCode ?? "";
    const enabled = widgetData?.liveChatEnabled ?? true;
    const detected = detectProvider(code);
    const provider = detected ?? PROVIDERS[0];
    const fields   = provider.id !== "custom" ? provider.extractFields(code) : {};
    setSelectedProvider(provider);
    setProviderFields(fields);
    setCustomCode(provider.id === "custom" ? code : "");
    setWidgetEnabled(enabled);
    setValidationError(null);
    setWidgetDialogOpen(true);
  };

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id) ?? PROVIDERS[0];
    setSelectedProvider(p); setProviderFields({}); setCustomCode(""); setValidationError(null);
  };

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...providerFields, [key]: value };
    setProviderFields(updated); setValidationError(null);
  };

  const generatedCode = selectedProvider.id === "custom"
    ? customCode
    : (() => {
        const allFilled = selectedProvider.fields.every((f) => providerFields[f.key]?.trim());
        return allFilled ? selectedProvider.generate(providerFields) : "";
      })();

  // ── Widget mutations ───────────────────────────────────────────────────────
  const widgetSaveMut = useMutation({
    mutationFn: (data: Parameters<typeof portalUpdateLiveChatWidget>[0]) =>
      portalUpdateLiveChatWidget(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-live-chat-widget"] });
      qc.invalidateQueries({ queryKey: ["portal-live-chat-audit"] });
      setWidgetDialogOpen(false);
      toast({ title: "Live chat widget saved", description: "Waiting for the public site to confirm it loaded." });
    },
    onError: (err: any) => {
      // 422 validation failure — keep dialog open and show inline error.
      if (err?.code === "INVALID_SCRIPT" || err?.error) {
        setValidationError(err.error ?? "Invalid embed code. Please check your provider's integration guide.");
      } else {
        toast({ title: "Error", description: err?.error ?? "Unexpected error", variant: "destructive" });
      }
    },
  });

  const widgetToggleMut = useMutation({
    mutationFn: (enabled: boolean) => portalUpdateLiveChatWidget({ liveChatEnabled: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-live-chat-widget"] });
      qc.invalidateQueries({ queryKey: ["portal-live-chat-audit"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.error ?? e.message, variant: "destructive" }),
  });

  const widgetRemoveMut = useMutation({
    mutationFn: () => portalUpdateLiveChatWidget({ liveChatCode: "", liveChatEnabled: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-live-chat-widget"] });
      qc.invalidateQueries({ queryKey: ["portal-live-chat-audit"] });
      toast({ title: "Live chat widget removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.error ?? e.message, variant: "destructive" }),
  });

  const saveWidget = () => {
    if (!generatedCode.trim()) {
      setValidationError("Please fill in your provider credentials to generate the embed code.");
      return;
    }
    widgetSaveMut.mutate({ liveChatCode: generatedCode, liveChatEnabled: widgetEnabled });
  };

  const currentProvider = widgetData?.liveChatCode ? detectProvider(widgetData.liveChatCode) : null;

  // ── Support Channels ────────────────────────────────────────────────────────
  const [chOpen, setChOpen]         = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["portal-channels"],
    queryFn:  portalListChannels,
  });

  const typeInfo = CHANNEL_TYPES.find((t) => t.value === form.channelType);
  const setConf  = (k: string, v: string) => setForm((f) => ({ ...f, config: { ...f.config, [k]: v } }));

  const createMut = useMutation({
    mutationFn: (d: any) => portalCreateChannel(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portal-channels"] }); setChOpen(false); toast({ title: "Channel added" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.error ?? e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: any) => portalUpdateChannel(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portal-channels"] }); setChOpen(false); toast({ title: "Channel updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.error ?? e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => portalDeleteChannel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portal-channels"] }); setDeleteTarget(null); toast({ title: "Channel removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.error ?? e.message, variant: "destructive" }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isEnabled }: any) => portalUpdateChannel(id, { isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-channels"] }),
  });

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, config: {} }); setChOpen(true); };
  const openEdit   = (c: any) => { setEditing(c); setForm({ channelType: c.channelType, label: c.label, config: { ...c.config }, isEnabled: c.isEnabled }); setChOpen(true); };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <PortalLayout>
      <div className="p-6 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-white">Customer Support</h1>
          <p className="text-slate-400 text-sm mt-1">Configure how your customers can reach your support team</p>
        </div>

        {/* ── Live Chat Widget Card ─────────────────────────────────────────── */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white text-lg">Live Chat Widget</CardTitle>
            </div>
            <p className="text-slate-400 text-sm">
              Embed a floating chat bubble on your public website. Works with Smartsupp, Tawk.to, Crisp, Intercom, Zendesk Chat, LiveChat, and custom widgets.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {widgetLoading ? (
              <div className="h-14 rounded-lg bg-slate-700/50 animate-pulse" />
            ) : widgetData?.liveChatCode ? (
              <>
                {/* ── Configured widget row ───────────────────────────────── */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{currentProvider?.name ?? "Custom Widget"}</span>
                      <StatusBadge
                        status={widgetData.liveChatStatus as LiveChatStatus}
                        enabled={widgetData.liveChatEnabled}
                      />
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{currentProvider?.description ?? "Custom embed code configured"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Emergency disable toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetData.liveChatEnabled}
                        onCheckedChange={(v) => widgetToggleMut.mutate(v)}
                        disabled={widgetToggleMut.isPending}
                      />
                      <span className="text-slate-400 text-sm hidden sm:inline">
                        {widgetData.liveChatEnabled ? "On" : "Off"}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={openWidgetDialog}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => widgetRemoveMut.mutate()} disabled={widgetRemoveMut.isPending}
                      className="border-red-900/50 text-red-400 hover:bg-red-900/20">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Failed to Load — actionable hint */}
                {widgetData.liveChatStatus === "failed" && widgetData.liveChatEnabled && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      The widget script failed to load on your public site. This usually means the API key or ID is incorrect.
                      Click <strong>Edit</strong> to update your credentials.
                    </span>
                  </div>
                )}

                {/* Pending hint */}
                {(widgetData.liveChatStatus === "pending" || !widgetData.liveChatStatus) && widgetData.liveChatEnabled && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Waiting for a customer-facing page to load and confirm the widget is working.
                      Visit your public website to trigger the check, then refresh this page.
                    </span>
                  </div>
                )}

                {/* Configuration history toggle */}
                <div>
                  <button
                    onClick={() => setAuditOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 text-xs transition-colors"
                  >
                    {auditOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <History className="w-3.5 h-3.5" />
                    Configuration History
                  </button>
                  {auditOpen && (
                    <div className="mt-3 space-y-2 border-t border-slate-700/60 pt-3">
                      {auditLoading ? (
                        <p className="text-slate-500 text-xs">Loading…</p>
                      ) : auditLog.length === 0 ? (
                        <p className="text-slate-500 text-xs">No configuration events yet.</p>
                      ) : (
                        auditLog.slice(0, 20).map((entry: any) => (
                          <div key={entry.id} className="flex items-start gap-2">
                            {auditIcon(entry.action)}
                            <div className="min-w-0">
                              <span className="text-slate-300 text-xs">{auditLabel(entry.action)}</span>
                              {entry.details?.provider && (
                                <span className="text-slate-500 text-xs ml-1">({entry.details.provider})</span>
                              )}
                              {entry.details?.reason && (
                                <span className="text-red-400 text-xs ml-1">— {entry.details.reason}</span>
                              )}
                              <p className="text-slate-600 text-xs">
                                {new Date(entry.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── No widget configured ─────────────────────────────────── */
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium mb-1">No live chat widget configured</p>
                <p className="text-slate-500 text-sm mb-4">Add a floating chat bubble so visitors can reach you instantly</p>
                <Button onClick={openWidgetDialog} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Live Chat Widget
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Support Channels Section ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Support Channels</h2>
              <p className="text-slate-400 text-xs mt-0.5">WhatsApp, email, phone, and other contact options shown to customers</p>
            </div>
            <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Add Channel
            </Button>
          </div>

          {channelsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i} className="bg-slate-800/60 border-slate-700 animate-pulse h-20" />)}</div>
          ) : channels.length === 0 ? (
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="py-12 text-center">
                <HeadphonesIcon className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No support channels configured</p>
                <p className="text-slate-500 text-sm mt-1">Add channels so customers know how to reach you</p>
                <Button onClick={openCreate} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Channel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {channels.map((c: any) => {
                const Icon = CHANNEL_ICONS[c.channelType] ?? HeadphonesIcon;
                const typeLabel = CHANNEL_TYPES.find((t) => t.value === c.channelType)?.label ?? c.channelType;
                return (
                  <Card key={c.id} className="bg-slate-800/60 border-slate-700 hover:border-slate-600 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{c.label}</span>
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{typeLabel}</Badge>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{Object.values(c.config ?? {}).join(" · ")}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Switch checked={c.isEnabled} onCheckedChange={(v) => toggleMut.mutate({ id: c.id, isEnabled: v })} />
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="border-slate-600 text-slate-300 hover:bg-slate-700"><Edit2 className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(c)} className="border-red-900/50 text-red-400 hover:bg-red-900/20"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Live Chat Widget Dialog ───────────────────────────────────────────── */}
      <Dialog open={widgetDialogOpen} onOpenChange={(v) => { setWidgetDialogOpen(v); if (!v) setValidationError(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              {widgetData?.liveChatCode ? "Edit Live Chat Widget" : "Add Live Chat Widget"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Validation error (server-side rejection) ─────────────────── */}
            {validationError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-400">❌ Declined — Invalid Script</p>
                  <p className="mt-0.5 text-xs">{validationError}</p>
                </div>
              </div>
            )}

            {/* Provider selector */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">Chat Provider</Label>
              <Select value={selectedProvider.id} onValueChange={handleProviderChange}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium">{p.name}</span>
                      {p.id !== "custom" && <span className="text-slate-400 ml-2 text-xs">— {p.description}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provider-specific fields */}
            {selectedProvider.id !== "custom" && selectedProvider.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-slate-300">{field.label}</Label>
                <Input
                  value={providerFields[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            ))}

            {/* Custom script textarea */}
            {selectedProvider.id === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">Embed Code / Script</Label>
                <Textarea
                  value={customCode}
                  onChange={(e) => { setCustomCode(e.target.value); setValidationError(null); }}
                  placeholder={`Paste your complete embed code here, e.g.:\n\n<script type="text/javascript">\n  // Your provider's snippet\n\x3c/script>`}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 font-mono text-xs min-h-[120px] resize-y"
                />
                <p className="text-xs text-slate-500">
                  Supports external src= scripts, inline JS, and multi-script embeds.
                  The script is never executed during setup validation.
                </p>
              </div>
            )}

            {/* Generated code preview */}
            {selectedProvider.id !== "custom" && generatedCode && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <Label className="text-slate-300 text-xs">Generated Embed Code</Label>
                </div>
                <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                  {generatedCode}
                </div>
              </div>
            )}

            {/* Missing fields hint */}
            {selectedProvider.id !== "custom" && !generatedCode && selectedProvider.fields.length > 0 && (
              <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Fill in all fields above to generate the embed code automatically.
              </div>
            )}

            {/* Enable/disable toggle */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-700/50">
              <Switch checked={widgetEnabled} onCheckedChange={setWidgetEnabled} />
              <div>
                <Label className="text-slate-300">Enable widget on public site</Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  The chat bubble will {widgetEnabled ? "appear" : "be hidden"} on your customer-facing pages.
                  You can disable it any time without losing the configuration.
                </p>
              </div>
            </div>

            {/* Security note */}
            <p className="text-xs text-slate-600 border-t border-slate-700/40 pt-2">
              🔒 The widget only loads on public-facing pages. It never appears inside the admin portal.
              Configuration is validated server-side without executing the script.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWidgetDialogOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={saveWidget}
              disabled={widgetSaveMut.isPending || !generatedCode.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {widgetSaveMut.isPending ? "Validating…" : "Save Widget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Support Channel Add/Edit Dialog ──────────────────────────────────── */}
      <Dialog open={chOpen} onOpenChange={setChOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Channel" : "Add Support Channel"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Channel Type</Label>
              <Select value={form.channelType} onValueChange={(v) => setForm((f) => ({ ...f, channelType: v, config: {} }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                  {CHANNEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Display Label</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. WhatsApp Support" className="bg-slate-800 border-slate-600 text-white" />
            </div>
            {typeInfo?.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label>{field.label}</Label>
                <Input value={form.config[field.key] ?? ""} onChange={(e) => setConf(field.key, e.target.value)} className="bg-slate-800 border-slate-600 text-white" />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={() => { if (editing) updateMut.mutate({ id: editing.id, d: form }); else createMut.mutate(form); }}
              disabled={createMut.isPending || updateMut.isPending} className="bg-blue-600 hover:bg-blue-700">
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Channel Confirm ────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Remove Channel</DialogTitle></DialogHeader>
          <p className="text-slate-400 text-sm">Remove <strong className="text-white">{deleteTarget?.label}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending} className="bg-red-600 hover:bg-red-700">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
