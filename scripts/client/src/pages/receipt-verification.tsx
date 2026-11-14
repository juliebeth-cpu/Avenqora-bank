import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, FileCheck2, PackageCheck, ShieldCheck } from "lucide-react";

interface Props {
  params: { token: string };
}

async function fetchVerification(token: string) {
  const response = await fetch(`/api/public/receipts/verify/${encodeURIComponent(token)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok && !body?.receiptNumber) {
    return { valid: false, message: body?.message ?? "Receipt could not be verified" };
  }
  return body;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{String(value)}</p>
    </div>
  );
}

export default function ReceiptVerificationPage({ params }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["receipt-verification", params.token],
    queryFn: () => fetchVerification(params.token),
    retry: false,
  });

  const isValid = data?.valid === true;
  const isShipment = data?.receiptType === "Package Tracking Shipment" || data?.receiptType === "Logistics Shipment";
  const status = data?.verificationStatus ?? "INVALID";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Danzy GLE</p>
            <h1 className="text-2xl font-bold tracking-tight">Receipt Verification</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            <p className="mt-4 text-sm text-slate-500">Checking the authoritative receipt record…</p>
          </div>
        ) : !isValid && !data?.receiptNumber ? (
          <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-red-600" />
              <div>
                <h2 className="text-xl font-bold text-red-900">Receipt Could Not Be Verified</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This verification reference is invalid or no longer available. No other receipt was selected.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className={`p-6 ${isValid ? "bg-emerald-950 text-white" : "bg-amber-950 text-white"}`}>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex items-start gap-3">
                  {isValid ? <CheckCircle2 className="mt-0.5 h-7 w-7 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-7 w-7 text-amber-300" />}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Receipt Verification</p>
                    <h2 className="mt-1 text-2xl font-bold">{isValid ? "Verified Receipt" : "Receipt Record Found"}</h2>
                    <p className="mt-2 text-sm text-white/75">{data.receiptType ?? "Receipt"} · {status}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Receipt Number</p>
                  <p className="mt-1 font-mono text-sm font-bold">{data.receiptNumber}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  {isShipment ? <PackageCheck className="h-5 w-5 text-blue-700" /> : <FileCheck2 className="h-5 w-5 text-blue-700" />}
                  <h3 className="font-semibold text-slate-900">Authoritative receipt details</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Verification status" value={data.verificationStatus} />
                  <Field label="Receipt status" value={data.receiptStatus} />
                  <Field label="Receipt type" value={data.receiptType} />
                  <Field label="Date and time" value={formatDate(data.date)} />
                  {!isShipment && <Field label="Transaction type" value={data.transactionType} />}
                  {!isShipment && <Field label="Transaction reference" value={data.transactionReference} />}
                  {!isShipment && <Field label="Amount" value={data.amount != null ? `${data.currency ?? ""} ${data.amount}`.trim() : null} />}
                  {!isShipment && <Field label="Payment method" value={data.paymentMethod} />}
                  {isShipment && <Field label="Tracking number" value={data.trackingNumber} />}
                  {isShipment && <Field label="Shipment reference" value={data.referenceNumber} />}
                  {isShipment && <Field label="Origin" value={[data.origin?.city, data.origin?.country, data.origin?.airport].filter(Boolean).join(" · ")} />}
                  {isShipment && <Field label="Destination" value={[data.destination?.city, data.destination?.country, data.destination?.airport].filter(Boolean).join(" · ")} />}
                  {isShipment && <Field label="Transport" value={[data.transport?.type, data.transport?.airline, data.transport?.flightNumber].filter(Boolean).join(" · ")} />}
                  {isShipment && <Field label="Sender" value={data.senderName} />}
                  {isShipment && <Field label="Receiver" value={data.recipientName} />}
                  {isShipment && <Field label="Service" value={data.serviceLevel} />}
                  {isShipment && <Field label="Weight" value={data.weight} />}
                  {isShipment && <Field label="Dimensions" value={data.dimensions} />}
                  {isShipment && <Field label="Package description" value={data.packageDescription} />}
                  {isShipment && <Field label="Estimated delivery" value={data.estimatedDelivery} />}
                </div>
              </section>

              <div className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                This page resolves the receipt from its server-generated verification reference. It does not use browser storage, customer login, or query-string receipt data.
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="font-medium text-slate-700 hover:underline">Return to Danzy GLE</Link>
        </p>
      </div>
    </main>
  );
}