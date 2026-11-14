import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function TransactionPinInput({ value, onChange, className = "" }: Props) {
  return (
    <div className={className}>
      <label className="text-sm font-medium text-slate-300">Transaction PIN</label>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="4 to 6 digits"
        className="mt-1 bg-slate-900/60 border-slate-700 text-white"
      />
      <p className="text-xs text-slate-500 mt-1">Required to authorize this transaction.</p>
    </div>
  );
}