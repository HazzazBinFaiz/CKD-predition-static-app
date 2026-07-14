# CKD Screening — static React app

In-browser CKD prediction + local (per-patient) explanation. No backend.

## Files you must add to `public/`
- `model.onnx`        (your best model — CatBoost)
- `preprocess.json`   (scaling + encoding info)

Do NOT add `ckd_model_bundle.joblib` — it is a Python pickle and is not used
by the web app.

## Develop
    pnpm install
    pnpm dev

## Build static site
    pnpm build      # outputs to dist/
    pnpm preview    # test the production build locally

Deploy the `dist/` folder to GitHub Pages, Netlify, Vercel, or any static host.
