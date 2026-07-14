# CKD Screening — Web Application

A fully client-side web application for **Chronic Kidney Disease (CKD) screening**,
built as the companion tool for an undergraduate research project. A user enters a
patient's lab and clinical values and receives a prediction together with a
per-value, human-readable explanation of the result — all computed **in the
browser**, with no backend and no data ever leaving the device.

## Research

This application accompanies the research conducted by:

- **Md. Hazzaz Bin Faiz**
- **Md. Abdullah Al Naim**
- **Md. Abdul Gaffar**

Students of **Southeast University**.

The research trains and hyperparameter-tunes a range of machine-learning models
(including tree ensembles such as CatBoost, XGBoost, LightGBM, Random Forest, and
others) to classify CKD from routine clinical features, and selects the best model
for deployment. This web app serves that trained model to end users.

## Features

- **In-browser inference** — the selected model runs locally via ONNX Runtime Web (WebAssembly).
- **Explainable results** — an occlusion-based local attribution shows how each entered
  value pushed the risk up or down, as a diverging contribution chart.
- **Plain-language summary** — a readable interpretation of each prediction.
- **Medical disclaimer** — a clear notice that the output is a machine-learning estimate,
  not a diagnosis, and that a doctor should be consulted.
- **Printable report** — export the inputs, prediction, explanation, and comment as a
  clean one-page report (Print / Save as PDF).
- **No backend, no tracking** — deployable as a static site; patient data stays in the browser.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) with shadcn-style UI components
- [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/) for in-browser model inference
- pnpm for package management

## Project structure

```
public/
  model.onnx          # the trained best model (exported to ONNX)
  preprocess.json     # feature order, encodings, scaler stats, imputation values
src/
  App.jsx             # UI, explanation rendering, printable report
  ckd.js              # model loading, inference, occlusion explanation
  meta.js             # readable clinical names for the dataset features
  main.jsx, index.css
```

## Getting started

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

### Model files

Place the two exported files in `public/`:

- `model.onnx` — the trained model in ONNX format
- `preprocess.json` — the preprocessing metadata used at inference

The `ckd_model_bundle.joblib` produced during training is a Python artifact and is
**not** used by the web app (browsers cannot run it). Keep it for archiving only.

## Build

```bash
pnpm build          # outputs a static site to dist/
pnpm preview        # preview the production build locally
```

## How the explanation works

For each prediction, the app scores the patient, then re-scores the model once per
feature with that feature reset to its training baseline, measuring how much the
predicted probability of CKD changes. Those signed changes are shown as the
per-feature contributions. This is an occlusion-based local attribution — an
approximation of SHAP that runs entirely in the browser without a server.

## Disclaimer

This application is a screening aid produced by a machine-learning model for research
and demonstration purposes. It is **not** a medical device and does **not** provide a
diagnosis. Always consult a qualified healthcare professional for medical advice.
