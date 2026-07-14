import { useEffect, useMemo, useState } from "react";
import { loadModel, explain } from "./ckd";
import { META } from "./meta";

const RISK = "#ef4444"; // red-500  (raises risk)
const SAFE = "#059669"; // emerald-600 (lowers risk)

/* ---------- shadcn-style primitives (no external deps) ---------- */
const cn = (...c) => c.filter(Boolean).join(" ");

const Card = ({ className, children }) => (
  <div className={cn("rounded-xl border border-zinc-200 bg-white shadow-sm", className)}>{children}</div>
);
const CardHeader = ({ children }) => <div className="px-6 pt-6 pb-2">{children}</div>;
const CardTitle = ({ children }) => (
  <h2 className="text-sm font-semibold tracking-tight text-zinc-950">{children}</h2>
);
const CardContent = ({ className, children }) => <div className={cn("px-6 pb-6", className)}>{children}</div>;

const Button = ({ variant = "default", className, ...props }) => {
  const v = {
    default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90",
    outline: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        v, className
      )}
      {...props}
    />
  );
};

const Badge = ({ tone = "default", children }) => {
  const t = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200",
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", t)}>
      {children}
    </span>
  );
};

const IconWarn = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);
const IconPrint = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="14" />
  </svg>
);

const Disclaimer = () => (
  <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
    <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
    <div>
      <p className="font-medium">Not a medical diagnosis</p>
      <p className="text-amber-800">
        This result is the output of a trained machine-learning model, not a clinical diagnosis.
        Please consult a qualified doctor for proper evaluation and advice.
      </p>
    </div>
  </div>
);

/* ---------- plain-language summary ---------- */
function humanComment(result, ranked) {
  const p = result.p0;
  const isCKD = p >= 0.5;
  const conf = Math.round((isCKD ? p : 1 - p) * 100);
  const strength = conf >= 85 ? "high" : conf >= 65 ? "moderate" : "low";
  const names = (arr) => arr.map((c) => (META[c.feat] || [c.feat])[0].toLowerCase());
  const up = names(ranked.filter((c) => c.delta > 0).slice(0, 3));
  const down = names(ranked.filter((c) => c.delta < 0).slice(0, 3));

  let s = isCKD
    ? `Based on the values entered, the model predicts this patient likely has chronic kidney disease (CKD), with about ${conf}% confidence (${strength}). `
    : `Based on the values entered, the model predicts this patient likely does not have CKD, with about ${conf}% confidence (${strength}). `;
  if (isCKD && up.length) s += `The values pushing the result toward CKD the most were ${up.join(", ")}. `;
  if (!isCKD && down.length) s += `The values that most lowered the estimated risk were ${down.join(", ")}. `;
  s += `This is an automated screening estimate only — please see a doctor for a proper assessment.`;
  return s;
}

/* ---------- printable report ---------- */
function PrintReport({ pp, values, result, ranked, comment }) {
  const isCKD = result.p0 >= 0.5;
  const order = [...pp.numeric_features, ...pp.categorical_features].filter((f) => pp.feature_order.includes(f));
  const cell = "border border-zinc-300 px-2 py-1 text-left align-top";
  return (
    <div className="mx-auto hidden max-w-3xl px-8 py-6 text-zinc-950 print:block">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">CKD Screening Report</h1>
        <span className="text-xs text-zinc-500">Generated {new Date().toLocaleString()}</span>
      </div>
      <p className="mb-4 text-xs text-zinc-500">Model: {pp.best_model_name || "CKD classifier"}</p>

      <div className="mb-4"><Disclaimer /></div>

      <h2 className="mb-1 text-sm font-semibold">Prediction</h2>
      <p className="mb-4">
        <b style={{ color: isCKD ? RISK : SAFE }}>{isCKD ? "CKD" : "Not CKD"}</b>
        {"  —  "}P(CKD) = {result.p0.toFixed(3)} (baseline patient: {result.pBase.toFixed(3)})
      </p>

      <h2 className="mb-1 text-sm font-semibold">Interpretation</h2>
      <p className="mb-4 text-sm">{comment}</p>

      <h2 className="mb-1 text-sm font-semibold">Patient values</h2>
      <table className="mb-4 w-full border-collapse text-sm">
        <tbody>
          {order.map((f) => (
            <tr key={f}>
              <td className={cell}>{(META[f] || [f])[0]}</td>
              <td className={cell}>{String(values[f])}{(META[f] || [f, ""])[1] ? ` ${(META[f])[1]}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-1 text-sm font-semibold">Top contributing factors</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={cell}>Factor</th><th className={cell}>Value</th>
            <th className={cell}>Effect on risk</th><th className={cell}>Δ P(CKD)</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((c) => (
            <tr key={c.feat}>
              <td className={cell}>{(META[c.feat] || [c.feat])[0]}</td>
              <td className={cell}>{String(c.raw)}</td>
              <td className={cell} style={{ color: c.delta > 0 ? RISK : SAFE }}>
                {c.delta > 0 ? "raises ↑" : "lowers ↓"}
              </td>
              <td className={cell}>{c.delta > 0 ? "+" : ""}{c.delta.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-xs text-zinc-500">
        Explanation method: occlusion-based local attribution (each value reset to baseline and re-scored).
        For demonstration only; not a diagnosis.
      </p>
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [pp, setPp] = useState(null);
  const [session, setSession] = useState(null);
  const [values, setValues] = useState({});
  const [status, setStatus] = useState("Loading model…");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadModel()
      .then(({ pp, session }) => {
        setPp(pp); setSession(session);
        const init = {};
        pp.feature_order.forEach((f) => (init[f] = pp.impute[f]));
        setValues(init);
        setStatus("Model ready. Enter values and run screening.");
      })
      .catch((e) => setStatus("Could not load model.onnx / preprocess.json — " + e));
  }, []);

  const setVal = (f, v) => setValues((s) => ({ ...s, [f]: v }));

  const run = async () => {
    setBusy(true); setStatus("Scoring…");
    const r = await explain(session, pp, values);
    setResult(r);
    setStatus(r.hasProba ? "Done." : "Model returns labels only — contributions are coarse.");
    setBusy(false);
  };

  const reset = () => {
    const init = {};
    pp.feature_order.forEach((f) => (init[f] = pp.impute[f]));
    setValues(init); setResult(null); setStatus("Reset to baseline.");
  };

  const ranked = useMemo(() => {
    if (!result) return [];
    return result.contrib
      .filter((c) => Math.abs(c.delta) > 1e-4)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8);
  }, [result]);

  if (!pp)
    return <div className="grid min-h-screen place-items-center text-sm text-zinc-500">{status}</div>;

  const ordered = [...pp.numeric_features, ...pp.categorical_features].filter((f) => pp.feature_order.includes(f));
  const isCKD = result && result.p0 >= 0.5;
  const maxAbs = Math.max(...ranked.map((c) => Math.abs(c.delta)), 1e-4);
  const comment = result ? humanComment(result, ranked) : "";

  const inputCls =
    "flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950";

  return (
    <div className="min-h-screen bg-neutral-50 text-zinc-950">
      {/* interactive UI (hidden when printing) */}
      <div className="mx-auto max-w-5xl px-5 py-10 print:hidden">
        <header className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Chronic Kidney Disease · in-browser model
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">CKD Screening</h1>
          <p className="mt-1.5 max-w-[54ch] text-sm text-zinc-500">
            Enter a patient's lab and clinical values for a prediction and a per-value explanation.
            Everything runs on your device.
          </p>
          <div className="mt-3"><Badge>model: {pp.best_model_name || "CKD classifier"}</Badge></div>
        </header>

        <div className="mb-6"><Disclaimer /></div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
          {/* inputs */}
          <Card>
            <CardHeader><CardTitle>Patient values</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                {ordered.map((f) => {
                  const [name, unit] = META[f] || [f, ""];
                  const cat = pp.categorical_features.includes(f);
                  return (
                    <div key={f} className="flex flex-col gap-1.5">
                      <label htmlFor={`f_${f}`} className="text-sm font-medium text-zinc-800">
                        {name} <span className="text-xs font-normal text-zinc-400">{unit ? `${unit} · ${f}` : f}</span>
                      </label>
                      {cat ? (
                        <select id={`f_${f}`} className={inputCls} value={values[f]} onChange={(e) => setVal(f, e.target.value)}>
                          {Object.keys(pp.label_maps[f]).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input id={`f_${f}`} type="number" step="any" className={inputCls}
                          value={values[f]} onChange={(e) => setVal(f, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={run} disabled={busy}>Run screening</Button>
                <Button variant="outline" onClick={reset}>Reset to baseline</Button>
              </div>
              <p className="mt-3 min-h-[1.1rem] text-xs text-zinc-500">{status}</p>
            </CardContent>
          </Card>

          {/* result */}
          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Result</CardTitle>
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => window.print()}>
                    <IconPrint className="h-3.5 w-3.5" /> Print report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge tone={isCKD ? "red" : "green"}>{isCKD ? "CKD" : "Not CKD"}</Badge>
                  <span className="text-sm tabular-nums text-zinc-500">
                    P(CKD) = <b className="text-zinc-900">{result.p0.toFixed(3)}</b>
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full transition-[width] duration-500"
                    style={{ width: `${(result.p0 * 100).toFixed(1)}%`, background: isCKD ? RISK : SAFE }} />
                </div>
                <div className="mt-1 flex justify-between text-[0.68rem] tabular-nums text-zinc-400">
                  <span>Not CKD</span><span>0.5</span><span>CKD</span>
                </div>

                <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">{comment}</p>

                <div className="mt-5 mb-1 flex items-end justify-between">
                  <h3 className="text-sm font-semibold text-zinc-800">Why this result</h3>
                  <div className="text-[0.68rem] text-zinc-400">
                    <span style={{ color: SAFE }}>◀ lowers</span> · <span style={{ color: RISK }}>raises ▶</span>
                  </div>
                </div>
                <p className="mb-3 text-xs text-zinc-500">
                  Baseline patient scores <b className="text-zinc-700">P(CKD) = {result.pBase.toFixed(3)}</b>.
                </p>

                {ranked.map((c) => {
                  const [name] = META[c.feat] || [c.feat];
                  const pct = (Math.abs(c.delta) / maxAbs) * 50;
                  const risk = c.delta > 0;
                  return (
                    <div key={c.feat} className="grid grid-cols-[104px_1fr_54px] items-center gap-2.5 py-1">
                      <div className="truncate text-sm">
                        {name}<span className="block text-[0.68rem] tabular-nums text-zinc-400">{String(c.raw)}</span>
                      </div>
                      <div className="relative h-5 rounded bg-zinc-100">
                        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-300" />
                        <div className="absolute top-1 h-3 rounded-sm"
                          style={{ width: `${pct}%`, background: risk ? RISK : SAFE, left: risk ? "50%" : "auto", right: risk ? "auto" : "50%" }} />
                      </div>
                      <div className="text-right text-xs tabular-nums" style={{ color: risk ? RISK : SAFE }}>
                        {c.delta > 0 ? "+" : ""}{c.delta.toFixed(3)}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <p className="mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-400">
          Explanation runs locally (occlusion-based local attribution). Demonstration only; not a diagnosis.
        </p>
      </div>

      {/* print-only report */}
      {result && <PrintReport pp={pp} values={values} result={result} ranked={ranked} comment={comment} />}
    </div>
  );
}
