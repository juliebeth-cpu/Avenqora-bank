import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import CountrySelect from "./CountrySelect";

interface RegistrationConfig {
  requireDateOfBirth?: boolean;
  requireHomeAddress?: boolean;
  requireKycVerification?: boolean;
  supportedIdTypes?: string[];
  requirePin?: boolean;
  collectDuringRegistration?: boolean;
  websiteUid?: string;
  accountTypes?: string[];
}

interface CapabilityConfig {
  accountTypes?: string[];
  country?: "required" | "optional" | "hidden";
  transactionPin?: boolean;
  kyc?: {
    enabled?: boolean;
    mode?: "disabled" | "optional" | "required";
    collectDuringRegistration?: boolean;
    supportedIdTypes?: string[];
    requireDateOfBirth?: boolean;
    requireHomeAddress?: boolean;
  };
}

interface Props {
  control: any;
  config?: RegistrationConfig | null;
  capabilities?: CapabilityConfig | null;
  paymentSite?: boolean;
  showAccountType?: boolean;
  showTransactionPin?: boolean;
  className?: string;
}

export default function RegistrationFields({
  control,
  config,
  capabilities,
  paymentSite = false,
  showAccountType,
  showTransactionPin,
  className = "",
}: Props) {
  const resolvedKyc = capabilities?.kyc;
  const collectKyc = Boolean(
    (resolvedKyc ? resolvedKyc.enabled && resolvedKyc.collectDuringRegistration : (paymentSite || config?.collectDuringRegistration || config?.requireKycVerification)),
  );
  const requirePersonalInformation = Boolean(paymentSite && !capabilities);
  const accountTypeVisible = showAccountType ?? Boolean(capabilities?.accountTypes?.length || (paymentSite && !capabilities));
  const transactionPinVisible = showTransactionPin ?? Boolean(capabilities?.transactionPin || config?.requirePin);
  const showTerms = Boolean(config?.websiteUid);
  if (!config && !paymentSite && !capabilities) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {(requirePersonalInformation || config?.requireDateOfBirth || config?.requireHomeAddress) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(requirePersonalInformation || config?.requireDateOfBirth) && (
            <FormField control={control} name="dateOfBirth" render={({ field }: any) => (
              <FormItem><FormLabel>Date of birth <span className="text-red-400">*</span></FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          )}
          {(requirePersonalInformation || config?.requireHomeAddress) && (
            <FormField control={control} name="homeAddress" render={({ field }: any) => (
              <FormItem><FormLabel>Home address <span className="text-red-400">*</span></FormLabel><FormControl><Input placeholder="Street address" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          )}
        </div>
      )}

      {((capabilities?.country === "required") || (paymentSite && !capabilities)) && (
        <FormField control={control} name="country" render={({ field }: any) => (
          <FormItem>
            <FormLabel className="text-slate-300">Country of residence <span className="text-red-400">*</span></FormLabel>
            <FormControl>
              <CountrySelect {...field} className="w-full h-11 rounded-md border border-slate-700 bg-slate-900/60 px-3 text-sm text-white" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}

      {collectKyc && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={control} name="documentType" render={({ field }: any) => (
            <FormItem><FormLabel className="text-slate-300">{paymentSite || config?.requireKycVerification ? "Identity document *" : "Identity document (optional)"}</FormLabel><FormControl><select {...field} className="w-full h-11 rounded-md border border-slate-700 bg-slate-900/60 px-3 text-sm text-white"><option value="">Select document type</option>{(config?.supportedIdTypes ?? ["passport", "national_id", "drivers_license", "other"]).map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={control} name="documentNumber" render={({ field }: any) => (
            <FormItem><FormLabel className="text-slate-300">Document number {paymentSite && <span className="text-red-400">*</span>}</FormLabel><FormControl><Input placeholder="Document number" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
      )}

      {accountTypeVisible ? (
        <FormField control={control} name="accountType" render={({ field }: any) => (
          <FormItem>
            <FormLabel className="text-slate-300">Account type <span className="text-red-400">*</span></FormLabel>
            <FormControl>
              <select {...field} className="w-full h-11 rounded-md border border-slate-700 bg-slate-900/60 px-3 text-sm text-white">
                <option value="">Select account type</option>
                {(config?.accountTypes ?? ["checking", "savings"]).map((type) => (
                  <option key={type} value={type}>
                    {type === "checking" ? "Current / Checking" : type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      ) : null}

      {transactionPinVisible && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={control} name="transactionPin" render={({ field }: any) => (
            <FormItem><FormLabel>Transaction PIN</FormLabel><FormControl><Input type="password" inputMode="numeric" maxLength={6} placeholder="4 to 6 digits" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={control} name="confirmTransactionPin" render={({ field }: any) => (
            <FormItem><FormLabel>Confirm transaction PIN</FormLabel><FormControl><Input type="password" inputMode="numeric" maxLength={6} placeholder="Repeat PIN" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
      )}

      {showTerms && (
        <FormField control={control} name="termsAccepted" render={({ field }: any) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <FormControl>
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="mt-1 h-4 w-4 rounded border-slate-600 accent-current"
              />
            </FormControl>
            <div className="space-y-1">
              <FormLabel className="text-sm text-slate-300 font-normal">
                I agree to the{" "}
                <Link href={`/site/${config?.websiteUid}/terms`} className="underline text-blue-400 hover:text-blue-300">
                  Terms &amp; Conditions
                </Link>
                .
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )} />
      )}
    </div>
  );
}
