import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Lock, Send, Upload, User, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LockedCustomerInformationData {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  kycStatus?: string | null;
  dateOfBirth?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  selfieUrl?: string | null;
  kycAddress?: string | null;
  profilePhotoUrl?: string | null;
}

type ChangeField =
  | "firstName" | "lastName" | "phone" | "address" | "city" | "country"
  | "dateOfBirth" | "documentType" | "documentNumber"
  | "documentFrontUrl" | "documentBackUrl" | "selfieUrl";

interface ChangeRequest {
  id: number;
  field: ChangeField;
  requestedValue: string | null;
  previousValue: string | null;
  currentValue: string | null;
  reason: string;
  status: "waiting_team_review" | "approved" | "rejected";
  decisionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface Props {
  customer?: LockedCustomerInformationData | null;
  onPhotoChange: (file: File) => void;
  photoSaving?: boolean;
  accentClass?: string;
  panelClass?: string;
}

const LOCKED_MESSAGE = "You can't make this change right now. Please contact our customer support for further changes. Thank you.";
const TOKEN_KEYS = ["danzy_banking_token", "danzy_invest_token", "danzy_forex_token", "danzy_crypto_token"];
const FIELD_OPTIONS: Array<{ value: ChangeField; label: string; inputType?: string }> = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "country", label: "Country" },
  { value: "dateOfBirth", label: "Date of birth", inputType: "date" },
  { value: "documentType", label: "Identity document type" },
  { value: "documentNumber", label: "Identity document number" },
  { value: "documentFrontUrl", label: "Identity document front URL", inputType: "url" },
  { value: "documentBackUrl", label: "Identity document back URL", inputType: "url" },
  { value: "selfieUrl", label: "Identity selfie URL", inputType: "url" },
];

function getCustomerToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  return null;
}

async function customerInformationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getCustomerToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? "Unable to submit information change request");
  }
  return response.json();
}

function requestStatusLabel(status: ChangeRequest["status"]) {
  if (status === "waiting_team_review") return "Waiting for Team Review";
  if (status === "approved") return "Approved";
  return "Rejected";
}

function requestStatusIcon(status: ChangeRequest["status"]) {
  if (status === "approved") return CheckCircle2;
  if (status === "rejected") return XCircle;
  return Clock3;
}

export default function LockedCustomerInformation({
  customer,
  onPhotoChange,
  photoSaving = false,
  accentClass = "text-blue-400",
  panelClass = "bg-slate-800/60 border-slate-700/60",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [selectedField, setSelectedField] = useState<ChangeField>("firstName");
  const [requestedValue, setRequestedValue] = useState("");
  const [reason, setReason] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const { data: requests = [], isLoading: requestsLoading } = useQuery<ChangeRequest[]>({
    queryKey: ["customer-information-change-requests"],
    queryFn: () => customerInformationRequest<ChangeRequest[]>("/customer/information-change-requests"),
    enabled: Boolean(customer),
  });
  const requestMutation = useMutation({
    mutationFn: () => customerInformationRequest<ChangeRequest>("/customer/information-change-requests", {
      method: "POST",
      body: JSON.stringify({ field: selectedField, requestedValue, reason }),
    }),
    onSuccess: () => {
      setRequestedValue("");
      setReason("");
      setShowRequestForm(false);
      queryClient.invalidateQueries({ queryKey: ["customer-information-change-requests"] });
    },
  });
  const fields = [
    ["Full name", [customer?.firstName, customer?.lastName].filter(Boolean).join(" ")],
    ["Username", customer?.username],
    ["Email", customer?.email],
    ["Phone", customer?.phone],
    ["Address", [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ")],
    ["Date of birth", customer?.dateOfBirth],
    ["KYC status", customer?.kycStatus?.replace(/_/g, " ")],
    ["KYC document", customer?.documentType],
    ["KYC document number", customer?.documentNumber],
    ["KYC address", customer?.kycAddress],
  ].filter(([, value]) => value);
  const availableOptions = FIELD_OPTIONS.filter(({ value }) => {
    const current = customer?.[value];
    return current !== undefined && current !== null && current !== "";
  });
  const selectedOption = FIELD_OPTIONS.find((option) => option.value === selectedField) ?? FIELD_OPTIONS[0];

  useEffect(() => {
    if (availableOptions.length > 0 && !availableOptions.some((option) => option.value === selectedField)) {
      setSelectedField(availableOptions[0].value);
    }
  }, [availableOptions, selectedField]);

  return (
    <section className={`rounded-xl border p-6 space-y-5 ${panelClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2"><Lock className={`w-4 h-4 ${accentClass}`} /> Personal Information</h2>
          <p className="text-slate-400 text-sm mt-1">Your registration information is read only.</p>
        </div>
        <div className="relative shrink-0">
          {customer?.profilePhotoUrl ? (
            <img src={customer.profilePhotoUrl} alt="Profile" className="w-14 h-14 rounded-full object-cover border border-white/20" />
          ) : (
            <div className={`w-14 h-14 rounded-full bg-white/10 flex items-center justify-center ${accentClass}`}><User className="w-6 h-6" /></div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPhotoChange(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm text-slate-200 mt-1 break-words capitalize">{value}</p>
          </div>
        ))}
      </div>

       <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={photoSaving} className="border-white/15 text-slate-200">
          <Upload className="w-4 h-4 mr-2" />{photoSaving ? "Uploading..." : "Change profile picture"}
        </Button>
         <Button type="button" variant="outline" onClick={() => setShowRequestForm((open) => !open)} className="border-white/15 text-slate-200">
           <Send className="w-4 h-4 mr-2" />Request an information change
         </Button>
         <p className="text-xs text-slate-500">Profile pictures remain independent. Protected information requires team approval.</p>
      </div>
       {showRequestForm && availableOptions.length > 0 && (
         <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-3">
           <div>
             <label className="text-xs text-slate-400 block mb-1">Information to correct</label>
             <select
               value={selectedField}
               onChange={(event) => { setSelectedField(event.target.value as ChangeField); setRequestedValue(""); }}
               className="w-full h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
             >
               {availableOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
             </select>
           </div>
           <div>
             <label className="text-xs text-slate-400 block mb-1">Correct value</label>
             <input
               type={selectedOption.inputType ?? "text"}
               value={requestedValue}
               onChange={(event) => setRequestedValue(event.target.value)}
               placeholder={`Enter the correct ${selectedOption.label.toLowerCase()}`}
               className="w-full h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-600"
             />
           </div>
           <div>
             <label className="text-xs text-slate-400 block mb-1">Reason for the request</label>
             <textarea
               value={reason}
               onChange={(event) => setReason(event.target.value)}
               rows={3}
               placeholder="Explain why this information needs to be corrected"
               className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
             />
           </div>
           {requestMutation.isError && <p className="text-sm text-red-400">{(requestMutation.error as Error).message}</p>}
           <div className="flex justify-end">
             <Button
               type="button"
               onClick={() => requestMutation.mutate()}
               disabled={requestMutation.isPending || !requestedValue.trim() || !reason.trim()}
               className="bg-blue-600 hover:bg-blue-700 text-white"
             >
               {requestMutation.isPending ? "Submitting..." : "Submit for Team Review"}
             </Button>
           </div>
         </div>
       )}
       <div className="border-t border-white/10 pt-4 space-y-3">
         <div className="flex items-center justify-between">
           <h3 className="text-sm font-semibold text-white">Information change requests</h3>
           {!requestsLoading && <span className="text-xs text-slate-500">{requests.length} total</span>}
         </div>
         {requests.length === 0 ? (
           <p className="text-xs text-slate-500">No information change requests yet.</p>
         ) : (
           <div className="space-y-2">
             {requests.map((request) => {
               const StatusIcon = requestStatusIcon(request.status);
               const label = FIELD_OPTIONS.find((option) => option.value === request.field)?.label ?? request.field;
               return (
                 <div key={request.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                   <div className="flex items-center justify-between gap-3">
                     <p className="text-sm text-slate-200">{label}</p>
                     <span className={`inline-flex items-center gap-1 text-xs ${request.status === "approved" ? "text-emerald-400" : request.status === "rejected" ? "text-red-400" : "text-amber-400"}`}>
                       <StatusIcon className="w-3.5 h-3.5" />{requestStatusLabel(request.status)}
                     </span>
                   </div>
                   <p className="text-xs text-slate-500 mt-1">{request.reason}</p>
                   {request.decisionReason && <p className="text-xs text-slate-400 mt-1">Team note: {request.decisionReason}</p>}
                 </div>
               );
             })}
           </div>
         )}
       </div>
      <p className="text-xs text-slate-500 border-t border-white/10 pt-4">{LOCKED_MESSAGE}</p>
    </section>
  );
}

export { LOCKED_MESSAGE };

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read profile picture"));
    reader.readAsDataURL(file);
  });
}
