import { useState, useCallback, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

function makeChallenge() {
  const a = Math.floor(Math.random() * 15) + 2;
  const b = Math.floor(Math.random() * 10) + 1;
  // Always add so answer is always positive and unambiguous
  const useAdd = Math.random() > 0.4;
  if (useAdd) {
    return { question: `${a} + ${b}`, answer: a + b };
  }
  // Subtract smaller from larger to avoid negatives
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return { question: `${hi} − ${lo}`, answer: hi - lo };
}

interface Props {
  onVerified: (verified: boolean) => void;
  /** Optional accent color for the border / icon */
  accentColor?: string;
}

export default function HumanVerification({ onVerified, accentColor = "#2563eb" }: Props) {
  const [challenge, setChallenge] = useState(makeChallenge);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");

  const refresh = useCallback(() => {
    setChallenge(makeChallenge());
    setInput("");
    setStatus("idle");
    onVerified(false);
  }, [onVerified]);

  const handleChange = useCallback(
    (val: string) => {
      setInput(val);
      const trimmed = val.trim();
      if (trimmed === "") {
        setStatus("idle");
        onVerified(false);
        return;
      }
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        if (num === challenge.answer) {
          setStatus("correct");
          onVerified(true);
        } else {
          setStatus("wrong");
          onVerified(false);
        }
      } else {
        setStatus("idle");
        onVerified(false);
      }
    },
    [challenge.answer, onVerified],
  );

  // Reset when challenge changes
  useEffect(() => { onVerified(false); }, [challenge]);

  const borderColor =
    status === "correct" ? "#22c55e" :
    status === "wrong"   ? "#ef4444" :
    "#334155";

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: "#0f1729", borderColor }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Verify You Are Human</p>
        <button
          type="button"
          onClick={refresh}
          className="text-slate-600 hover:text-slate-400 transition-colors"
          title="Get a new question"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex-1 flex items-center justify-center h-10 rounded-lg border font-mono font-bold text-white text-sm tracking-wider"
          style={{ background: "#060d1a", borderColor: "#1e293b" }}
        >
          {challenge.question} = ?
        </div>

        <div className="relative w-24">
          <input
            type="number"
            inputMode="numeric"
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Answer"
            className="w-full h-10 rounded-lg border bg-transparent text-white text-sm text-center font-semibold placeholder:text-slate-600 outline-none focus:ring-1 transition-colors"
            style={{
              borderColor,
              background: "#060d1a",
              /* remove spinners */
              MozAppearance: "textfield",
            } as React.CSSProperties}
            autoComplete="off"
          />
        </div>

        <div className="w-5 flex items-center justify-center flex-shrink-0">
          {status === "correct" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {status === "wrong"   && <XCircle      className="w-5 h-5 text-red-400"   />}
        </div>
      </div>

      {status === "wrong" && (
        <p className="text-xs text-red-400">Incorrect — try again or refresh the question.</p>
      )}
      {status === "correct" && (
        <p className="text-xs text-green-400">✓ Verification passed</p>
      )}
      {status === "idle" && (
        <p className="text-xs text-slate-600">Enter the answer to the math question above.</p>
      )}
    </div>
  );
}
