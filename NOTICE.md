# Third-party components

| Component | Where | Licence |
|---|---|---|
| MakeHuman hm08 base mesh and macro targets | `template/engine/assets/third_party/makehuman/` (and the body inside `android.glb`) | CC0 1.0 (see the NOTICE.md there) |
| Fonts: Archivo Black, Audiowide, IBM Plex Mono, Krona One, Lexend Zetta, Michroma, Share Tech Mono, UnifrakturCook, UnifrakturMaguntia, Zen Dots | `template/engine/fonts/` | SIL Open Font License 1.1 (https://openfontlicense.org) |
| Font: Syncopate | `template/engine/fonts/` | Apache License 2.0 |
| three.js, Playwright, ws | installed by npm at setup, not bundled | MIT / Apache-2.0 / MIT |
| kokoro-onnx (Python package) | installed by pip at setup | MIT |
| Kokoro-82M voice model (kokoro-v1.0.onnx, voices-v1.0.bin) | downloaded at setup from the kokoro-onnx GitHub releases | Apache-2.0 |
| mlx-whisper / faster-whisper, Whisper weights | installed by pip, weights fetched on first use | MIT |

Everything else (engine code, shot templates, props, docs, example episodes) belongs to the plugin's owner and is
shared for the owner's own use.

The HOLO style was reconstructed by measuring reference videos. No reference footage, frames, audio or scripts are
included in this plugin.
