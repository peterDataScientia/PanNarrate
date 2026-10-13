"""PanNarrate Chatterbox Multilingual V3 narrator for Hugging Face ZeroGPU.

The Space exposes /narrate for @gradio/client. Voice samples are optional and
must be the user's own voice, or one for which the user has explicit permission.
"""
import gc
import os
import re

import gradio as gr
import numpy as np
import spaces

MAX_CHARS = 500


def narrate(text: str, language: str, reference: str | None, consent: bool):
    if not text or not text.strip():
        raise gr.Error("Please enter text to narrate.")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_CHARS:
        raise gr.Error(f"One narration request can contain up to {MAX_CHARS} characters.")
    if language not in ("en", "sw"):
        raise gr.Error("Choose English or Kiswahili.")
    if reference and not consent:
        raise gr.Error("Your own voice or explicit speaker permission is required.")

    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device != "cuda":
        raise gr.Error("GPU unavailable. Select ZeroGPU hardware for this Space.")

    # Load inside the GPU allocation rather than at Space startup.
    model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model="v3")
    kwargs = {"language_id": language}
    if reference:
        kwargs["audio_prompt_path"] = reference
    with torch.inference_mode():
        wav = model.generate(text, **kwargs)
    signal = wav.detach().cpu().numpy().squeeze().astype(np.float32)
    rate = model.sr
    del model, wav
    gc.collect()
    torch.cuda.empty_cache()
    return (rate, signal)


@spaces.GPU(duration=120)
def generate(text, language, reference, consent):
    return narrate(text, language, reference, consent)


with gr.Blocks(title="PanNarrate Voice — AI academic narration") as demo:
    gr.Markdown("# PanNarrate Voice\nNeural speech for academic reading · English / Kiswahili · Chatterbox Multilingual V3")
    gr.Markdown("Audio is AI-generated. Only upload a voice sample you own or are authorized to use. Temporary media may be processed and cached by your Hugging Face Space; do not upload confidential recordings without reviewing your Space's access/privacy settings.")
    text = gr.Textbox(label="Text passage", lines=5, max_lines=8, max_length=MAX_CHARS,
                      value="Scientific research becomes easier to review when you can listen to the manuscript while reading the original document.")
    language = gr.Dropdown([("English", "en"), ("Kiswahili", "sw")], value="en", label="Narration language")
    reference = gr.Audio(label="Your own voice sample (optional)", sources=["upload", "microphone"], type="filepath")
    consent = gr.Checkbox(label="I own this voice or have explicit permission to reproduce it", value=False)
    button = gr.Button("Generate natural narration", variant="primary")
    output = gr.Audio(label="AI narration", type="numpy")
    button.click(fn=generate, inputs=[text,language,reference,consent], outputs=output,
                 api_name="narrate", concurrency_limit=1)
    gr.Markdown("Short passages are recommended for ZeroGPU's shared compute quota. Generated audio uses the Chatterbox watermark.")

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch()
