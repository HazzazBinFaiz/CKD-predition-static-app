// All in-browser model logic: load ONNX + preprocess.json, run inference,
// and produce a local (per-patient) occlusion explanation. No backend.
import * as ort from "onnxruntime-web";

// Serve the ORT WebAssembly runtime from the CDN so Vite needn't bundle it.
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

export async function loadModel() {
  const base = import.meta.env.BASE_URL; // works on GitHub Pages subpaths too
  const pp = await (await fetch(`${base}preprocess.json`)).json();
  const session = await ort.InferenceSession.create(`${base}model.onnx`);
  return { pp, session };
}

// Reproduce the notebook pipeline for one feature: encode -> standardize.
export function scaledValue(pp, feat, i, raw) {
  let enc;
  if (pp.categorical_features.includes(feat)) {
    const key = raw === "" || raw == null ? String(pp.impute[feat]) : String(raw);
    enc = pp.label_maps[feat][key];
    if (enc === undefined) enc = pp.label_maps[feat][String(pp.impute[feat])];
  } else {
    const n = parseFloat(raw);
    enc = raw === "" || raw == null || Number.isNaN(n) ? pp.impute[feat] : n;
  }
  return (enc - pp.scaler_mean[i]) / pp.scaler_scale[i];
}

export const buildVector = (pp, values) =>
  pp.feature_order.map((f, i) => scaledValue(pp, f, i, values[f]));

export const baselineVector = (pp) =>
  pp.feature_order.map((f, i) => scaledValue(pp, f, i, pp.impute[f]));

// One forward pass -> P(CKD). Handles both probability and label-only outputs.
export async function prob(session, vec) {
  const t = new ort.Tensor("float32", Float32Array.from(vec), [1, vec.length]);
  const out = await session.run({ [session.inputNames[0]]: t });
  for (const nm of session.outputNames) {
    const o = out[nm];
    if (o?.data?.length === 2) return { p: Number(o.data[1]), proba: true };
  }
  return { p: Number(out[session.outputNames[0]].data[0]), proba: false };
}

// Local explanation: reset each feature to baseline, measure the shift in P(CKD).
export async function explain(session, pp, values) {
  const x = buildVector(pp, values);
  const b = baselineVector(pp);
  const r0 = await prob(session, x);
  const rBase = await prob(session, b);

  const contrib = [];
  for (let i = 0; i < x.length; i++) {
    const xi = x.slice();
    xi[i] = b[i];
    const ri = await prob(session, xi);
    contrib.push({
      feat: pp.feature_order[i],
      delta: r0.p - ri.p, // + pushes toward CKD, - lowers risk
      raw: values[pp.feature_order[i]],
    });
  }
  return { p0: r0.p, pBase: rBase.p, contrib, hasProba: r0.proba };
}
