# PanNarrate

**AI-powered scientific PDF reader and narrator**, with original PDF viewing, extracted passages, optional voice cloning, and English/Kiswahili narration.

> Stage: functional frontend & self-hostable Gradio AI backend. The backend must be deployed separately; no paid or public AI service is secretly used as a fallback.

## What works

- Upload a PDF (up to 35 MB), render original pages with PDF.js, navigate and zoom.
- Extract embedded text in-browser, estimate two-column reading order, display reading passages, choose any passage and highlight its approximate PDF position.
- Narration controls: play/pause/stop, passage navigation, queue sequential passages, speed selector, English/Kiswahili, optional audio reference with explicit consent checkbox.
- Configure your own Hugging Face Gradio Space URL/ID (no API keys needed for public Spaces); Gradio client requests send only the selected passage and optional sample to your Space.
- AI narration via **Chatterbox Multilingual V3** with `t3_model="v3"`, running under HF ZeroGPU GPU allocation. The audio model requires GPU and may hit per-user quota limits.

## Known limitations

- Heuristic reading order can fail on complex figures, footnotes, tables, and unusual journal layouts. Test against the original PDF. OCR for scanned PDFs is not included.
- Highlighting is **passage-level and approximate**, not word-perfect audio alignment. There is no automatic scientific text editing.
- User voice samples travel to the configured Space for synthesis. Consent checkbox is an acknowledgement, not biometric identity verification. Hugging Face Spaces may temporarily cache uploaded files. Do not send unpublished confidential documents to an untrusted or public Space.
- The client currently limits synthesis requests to 500 characters. Long manuscripts need many requests and will exhaust free ZeroGPU quotas quickly.
- Reading speed changes playback rate and therefore pitch may be affected; model-side time stretching is not implemented.
- The frontend is deployable on Vercel but **requires an active compatible backend** for speech. No fake audio or browser synthetic voice fallback.

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
```

## Frontend deployment (Vercel)

Connect GitHub repository `peterDataScientia/PanNarrate` to a new Vercel project. Select Vite framework, build command `npm run build`, output `dist`. After creating your Hugging Face Space, set `VITE_HF_SPACE_ID=your-hf-username/PanNarrate-Voice` as a Vercel environment variable and redeploy, or enter the ID in the site's **Voice engine** settings. Do not put secrets in `VITE_` variables.

## Backend deployment (Hugging Face Spaces ZeroGPU)

1. Sign in to Hugging Face. Your personal account must meet ZeroGPU eligibility requirements (email verified, age >30 days, in good standing).
2. Create a new **Gradio** Space named `PanNarrate-Voice`.
3. Copy files from `space/` into the **root** of the Hugging Face Space repository (`README.md`, `app.py`, `requirements.txt`).
4. Choose ZeroGPU hardware under Space Settings, then inspect the build and run logs.
5. Test a short English and Kiswahili paragraph directly in the Space; only then connect the React app using `user/PanNarrate-Voice`.

`spaces.GPU` works only with the Gradio SDK. A standalone FastAPI inference server is not used for ZeroGPU here. The model is loaded inside GPU allocation, which may increase cold-start times.

## Privacy & voice ethics

PanNarrate is meant for reading legitimate academic content. Do not upload or clone someone else's voice without clear permission. The app does not store documents server-side; the original PDF and extracted text remain in the browser until explicitly requesting AI synthesis. Remote Space handling of uploaded speech audio is subject to the configured Space's privacy and retention policies.

## Acknowledgements

- [PDF.js](https://mozilla.github.io/pdf.js/)
- [Gradio](https://www.gradio.app/)
- [Chatterbox](https://github.com/resemble-ai/chatterbox) (MIT)
- [Hugging Face ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu)
