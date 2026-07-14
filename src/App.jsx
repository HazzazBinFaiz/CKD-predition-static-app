import { useEffect, useState } from "react";
import { loadModel, explain } from "./ckd";
import { META } from "./meta";

const RISK = "#D64545";
const SAFE = "#2F6FB3";

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
        setPp(pp);
        setSession(session);
        const init = {};
        pp.feature_order.forEach((f) => (init[f] = pp.impute[f]));
        setValues(init);
        setStatus("Model ready. Enter values and run screening.");
      })
      .catch((e) =>
        setStatus("Could not load model.onnx / preprocess.json — " + e)
      );
  }, []);

  const setVal = (f, v) => setValues((s) => ({ ...s, [f]: v }));

  const run = async () => {
    setBusy(true);
    setStatus("Scoring…");
    const r = await explain(session, pp, values);
    setResult(r);
    setStatus(
      r.hasProba
        ? "Done."
        : "Model returns labels only — contributions are coarse."
    );
    setBusy(false);
  };

  const reset = () => {
    const init = {};
    pp.feature_order.forEach((f) => (init[f] = pp.impute[f]));
    setValues(init);
    setResult(null);
    setStatus("Reset to baseline.");
  };

  if (!pp)
    return (
      <div className="min-h-screen grid place-items-center text-neutral-500 font-mono text-sm">
        {status}
      </div>
    );

  const ordered = [...pp.numeric_features, ...pp.categorical_features].filter(
    (f) => pp.feature_order.includes(f)
  );

  const isCKD = result && result.p0 >= 0.5;
  const ranked = result
    ? result.contrib
        .filter((c) => Math.abs(c.delta) > 1e-4)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 8)
    : [];
  const maxAbs = Math.max(...ranked.map((c) => Math.abs(c.delta)), 1e-4);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#171A1F]">
      <div className="max-w-5xl mx-auto px-5 py-10">
        {/* header */}
        <header className="border-b border-[#E6E4DD] pb-5 mb-6">
          <div className="font-mono text-xs tracking-[0.18em] uppercase text-neutral-500">
            Chronic Kidney Disease · in-browser model
          </div>
          <h1 className="font-[Space_Grotesk] font-bold text-3xl tracking-tight mt-1 mb-2">
            CKD Screening
          </h1>
          <p className="text-neutral-500 max-w-[52ch]">
            Enter a patient's lab and clinical values for a prediction and a
            per-value explanation. Everything runs on your device.
          </p>
          <span className="inline-flex items-center gap-2 mt-3 font-mono text-xs text-[#3A414B] border border-[#D8D5CC] rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full" style={{ background: SAFE }} />
            model: {pp.best_model_name || "CKD classifier"}
          </span>
        </header>

        <div className="grid md:grid-cols-[1fr_1.15fr] gap-6">
          {/* inputs */}
          <section className="bg-white border border-[#E6E4DD] rounded-2xl p-5">
            <h2 className="font-[Space_Grotesk] text-sm font-semibold uppercase tracking-wider text-[#3A414B] mb-4">
              Patient values
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
              {ordered.map((f) => {
                const [name, unit] = META[f] || [f, ""];
                const cat = pp.categorical_features.includes(f);
                return (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      {name}{" "}
                      <span className="font-mono text-[0.7rem] text-neutral-500">
                        {unit ? `${unit} · ${f}` : f}
                      </span>
                    </label>
                    {cat ? (
                      <select
                        className="font-mono text-sm px-2.5 py-2 border border-[#D8D5CC] rounded-lg bg-[#FAF9F6] focus:outline focus:outline-2 focus:outline-[#2F6FB3]"
                        value={values[f]}
                        onChange={(e) => setVal(f, e.target.value)}
                      >
                        {Object.keys(pp.label_maps[f]).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        className="font-mono text-sm px-2.5 py-2 border border-[#D8D5CC] rounded-lg bg-[#FAF9F6] focus:outline focus:outline-2 focus:outline-[#2F6FB3]"
                        value={values[f]}
                        onChange={(e) => setVal(f, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5 flex-wrap">
              <button
                onClick={run}
                disabled={busy}
                className="font-semibold text-sm rounded-lg px-5 py-2.5 bg-[#171A1F] text-white disabled:opacity-50 hover:brightness-125 transition"
              >
                Run screening
              </button>
              <button
                onClick={reset}
                className="font-semibold text-sm rounded-lg px-5 py-2.5 border border-[#D8D5CC] text-[#3A414B] hover:bg-[#FAF9F6] transition"
              >
                Reset to baseline
              </button>
            </div>
            <div className="font-mono text-xs text-neutral-500 mt-3 min-h-[1.1rem]">
              {status}
            </div>
          </section>

          {/* result */}
          {result && (
            <section className="bg-white border border-[#E6E4DD] rounded-2xl p-5">
              <h2 className="font-[Space_Grotesk] text-sm font-semibold uppercase tracking-wider text-[#3A414B] mb-4">
                Result
              </h2>

              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div
                  className="font-[Space_Grotesk] text-3xl font-bold tracking-tight"
                  style={{ color: isCKD ? RISK : SAFE }}
                >
                  {isCKD ? "CKD" : "Not CKD"}
                </div>
                <div className="font-mono text-sm text-neutral-500">
                  P(CKD) ={" "}
                  <b className="text-[#171A1F]">{result.p0.toFixed(3)}</b>
                </div>
              </div>

              <div className="h-2 rounded-full bg-[#E6E4DD] mt-4 mb-1 overflow-hidden">
                <div
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${(result.p0 * 100).toFixed(1)}%`,
                    background: isCKD ? RISK : SAFE,
                  }}
                />
              </div>
              <div className="flex justify-between font-mono text-[0.68rem] text-neutral-500">
                <span>Not CKD</span>
                <span>0.5</span>
                <span>CKD</span>
              </div>

              <div className="flex justify-between items-end mt-6 mb-0.5">
                <h3 className="font-[Space_Grotesk] text-sm font-semibold uppercase tracking-wider text-[#3A414B]">
                  Why this result
                </h3>
                <div className="font-mono text-[0.68rem] text-neutral-500">
                  <span style={{ color: SAFE }}>◀ lowers</span>{" "}
                  <span style={{ color: RISK }}>raises ▶</span>
                </div>
              </div>
              <p className="text-sm text-neutral-500 mb-3">
                A baseline patient scores{" "}
                <b className="text-[#171A1F]">
                  P(CKD) = {result.pBase.toFixed(3)}
                </b>
                . Bars show how each value shifted the risk.
              </p>

              {ranked.map((c) => {
                const [name] = META[c.feat] || [c.feat];
                const pct = (Math.abs(c.delta) / maxAbs) * 50;
                const risk = c.delta > 0;
                return (
                  <div
                    key={c.feat}
                    className="grid grid-cols-[110px_1fr_58px] items-center gap-2.5 py-1"
                  >
                    <div className="text-sm truncate">
                      {name}
                      <span className="block font-mono text-[0.68rem] text-neutral-500">
                        {String(c.raw)}
                      </span>
                    </div>
                    <div className="relative h-5 rounded bg-gradient-to-r from-[#E1ECF6] via-transparent to-[#F6E3E3]">
                      <div className="absolute top-0 left-1/2 w-px h-full -translate-x-1/2 bg-[#D8D5CC]" />
                      <div
                        className="absolute top-1 h-3 rounded-sm"
                        style={{
                          width: `${pct}%`,
                          background: risk ? RISK : SAFE,
                          left: risk ? "50%" : "auto",
                          right: risk ? "auto" : "50%",
                        }}
                      />
                    </div>
                    <div
                      className="font-mono text-xs text-right"
                      style={{ color: risk ? RISK : SAFE }}
                    >
                      {c.delta > 0 ? "+" : ""}
                      {c.delta.toFixed(3)}
                    </div>
                  </div>
                );
              })}

              <div className="mt-5 pt-4 border-t border-[#E6E4DD] text-sm">
                <b>Prediction: {isCKD ? "CKD" : "Not CKD"}.</b>{" "}
                {(() => {
                  const up = ranked
                    .filter((c) => c.delta > 0)
                    .slice(0, 3)
                    .map((c) => (META[c.feat] || [c.feat])[0]);
                  const down = ranked
                    .filter((c) => c.delta < 0)
                    .slice(0, 3)
                    .map((c) => (META[c.feat] || [c.feat])[0]);
                  return (
                    <>
                      {up.length > 0 &&
                        `Values raising risk most: ${up.join(", ")}. `}
                      {down.length > 0 &&
                        `Values lowering risk most: ${down.join(", ")}.`}
                    </>
                  );
                })()}
              </div>
            </section>
          )}
        </div>

        <p className="text-xs text-neutral-500 mt-6 pt-4 border-t border-[#E6E4DD]">
          Explanation runs locally: each value is reset to its baseline and the
          model re-scored, measuring that value's effect (occlusion-based local
          attribution). Demonstration only; not a diagnosis.
        </p>
      </div>
    </div>
  );
}
