import { WORLD_COUNTRIES } from "@/lib/world-countries";

interface Props {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  ref?: React.Ref<HTMLSelectElement>;
  required?: boolean;
  className?: string;
}

export default function CountrySelect({ value, onChange, onBlur, name, ref, required = true, className = "" }: Props) {
  return (
    <select
      ref={ref}
      name={name}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      required={required}
      className={className || "w-full h-11 rounded-md border border-border bg-background px-3 text-sm"}
    >
      <option value="">Select your country</option>
      {WORLD_COUNTRIES.map((country) => (
        <option key={country.code} value={country.code}>{country.name}</option>
      ))}
    </select>
  );
}