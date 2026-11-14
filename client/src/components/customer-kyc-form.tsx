import { useState } from "react";
import { AlertCircle, Upload } from "lucide-react";
import { bankingAttachKycFile, bankingRequestKycUpload, bankingUploadKycFile } from "@/lib/banking-api";

type KycFileSlot = "front" | "back" | "selfie";

interface Props {
  token: string;
  primaryColor?: string;
  submitKyc: (body: Record<string, unknown>) => Promise<{ id: number }>;
  onSubmitted: () => void;
  intro?: string;
}

export default function CustomerKycForm({
  token,
  primaryColor = "#2563eb",
  submitKyc,
  onSubmitted,
  intro = "Submit your identity details and supporting documents for review.",
}: Props) {
  const [form, setForm] = useState({
    documentType: "passport",
    documentNumber: "",
    fullName: "",
    dateOfBirth: "",
    address: "",
  });
  const [files, setFiles] = useState<Partial<Record<KycFileSlot, File>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const setFile = (slot: KycFileSlot) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setFiles((current) => ({ ...current, [slot]: file }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.documentNumber.trim() || !files.front) {
      setError("Full name, document number, and the front document are required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const submission = await submitKyc({
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        address: form.address.trim() || undefined,
      });

      for (const slot of ["front", "back", "selfie"] as const) {
        const file = files[slot];
        if (!file) continue;
        const upload = await bankingRequestKycUpload(token, submission.id, slot, file);
        await bankingUploadKycFile(upload.uploadURL, file);
        await bankingAttachKycFile(token, submission.id, slot, upload.objectPath);
      }
      onSubmitted();
    } catch (caught: any) {
      setError(caught?.message ?? "Unable to submit KYC");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
      <div>
        <h2 className="text-white font-semibold">Submit identity documents</h2>
        <p className="text-slate-400 text-sm mt-1">{intro}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm text-slate-300">
          Full name
          <input value={form.fullName} onChange={update("fullName")} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white" />
        </label>
        <label className="text-sm text-slate-300">
          Date of birth
          <input type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white" />
        </label>
        <label className="text-sm text-slate-300">
          Document type
          <select value={form.documentType} onChange={update("documentType")} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white">
            <option value="passport">Passport</option>
            <option value="national_id">National ID</option>
            <option value="drivers_license">Driver&apos;s License</option>
            <option value="utility_bill">Utility Bill</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Document number
          <input value={form.documentNumber} onChange={update("documentNumber")} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white" />
        </label>
      </div>
      <label className="block text-sm text-slate-300">
        Address
        <input value={form.address} onChange={update("address")} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white" />
      </label>
      <div className="grid sm:grid-cols-3 gap-4">
        {([
          ["front", "Document front", true],
          ["back", "Document back (if applicable)", false],
          ["selfie", "Selfie (if applicable)", false],
        ] as const).map(([slot, label, required]) => (
          <label key={slot} className="text-xs text-slate-400">
            {label}{required && <span className="text-red-400"> *</span>}
            <span className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-slate-500">
              <Upload className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{files[slot]?.name ?? "Choose file"}</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={setFile(slot)} className="sr-only" />
            </span>
          </label>
        ))}
      </div>
      {error && <p className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-50" style={{ backgroundColor: primaryColor }}>
        {saving ? "Uploading documents…" : "Submit for verification"}
      </button>
      <p className="text-xs text-slate-500">Accepted files: JPG, PNG, WEBP, or PDF up to 10 MB each.</p>
    </form>
  );
}