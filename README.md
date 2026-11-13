# Sephora AI

An independent, English-language AI website and responsive web application, inspired by the supplied visual references. The provided blue/violet logo is included. The front end uses Next.js (React/JavaScript), CSS, Lucide icons, IndexedDB and MathJax. This source package also includes Windows Electron and Android/iOS Capacitor build automation.

> Status: source implementation, not a deployed or fully tested production release. The default AI model and other entries are community-hosted. Availability, tool support, voice compatibility, fees and rate limits depend on the upstream providers. This project is not affiliated with the cosmetics retailer Sephora.

## 1. Run locally

Install Node.js 22 and Git. From the project root:

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local` instead of `cp`. Edit `.env.local` with your own keys; never add it to Git. Visit http://localhost:3000, then Start chat. `npm run build` compiles the production application; `npm run start` serves it. `npm test` checks the project layout and required model identifiers. The CI pipeline adds a production build and smoke checks.

## 2. GitHub + Vercel (the only hosting workflow required)

1. Create a new **private** GitHub repository named `sephora-ai` (empty, without an initial README). Extract this ZIP into a directory. Keep the `.github` directory: it contains CI and native packaging.
2. Push the source, including `.env.example` but not `.env.local`:

```bash
git init
git add .
git commit -m "Initial Sephora AI implementation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sephora-ai.git
git push -u origin main
```

Alternatively, if GitHub CLI is installed and authenticated: `gh repo create sephora-ai --private --source=. --remote=origin --push` after the first commit. GitHub's web upload can be used for ordinary files, but ensure hidden files and the `.github/workflows` directory are included.

3. At https://vercel.com/new import the GitHub repository, select Next.js, leave the root at the repository root, and configure the environment variables below. Vercel's Git integration handles automatic deployments on push. Deploy initially in private preview (`SITE_MODE=coming-soon`) and verify all providers before switching to public.
4. In GitHub → Actions → **Verify Sephora web**, confirm the workflow passes. In Vercel, confirm the build and preview work. Add production access controls and a distributed rate limiter before public launch.

### Vercel environment variables

| Variable | Required / behavior |
|---|---|
| `POLLINATIONS_API_KEY` | Your Pollinations secret key; chat, image, vision, transcription |
| `OPENROUTER_API_KEY` | Your OpenRouter secret key; text-to-speech |
| `POLLINATIONS_IMAGE_MODEL` | Optional approved image model override; default from your catalog is `community/scriptsnsenses-sys/sdxl-lightning-free` |
| `POLLINATIONS_VISION_MODEL` | Optional approved vision model override; default `community/Saauf/mistral-large-4` |
| `OPENROUTER_VOICE` | Voice ID supported by your Fish Audio endpoint, if required. Configure after checking the provider's model card. |
| `SITE_MODE` | `public`, `coming-soon`, or `maintenance` |
| `DEV_PASSWORD` | Strong private developer password |
| `DEV_TOTP_SECRET` | Private base32 Google Authenticator secret |
| `SESSION_SECRET` | Long random secret for signed developer sessions |

The API keys are used only in the server route. They are never `NEXT_PUBLIC_*`. `SITE_MODE=coming-soon` and `maintenance` protect the homepage, chat page and provider API routes using a signed, HttpOnly developer cookie. `/coming-soon` and `/maintenance` expose a password + six-digit TOTP form. These modes are configured by environment variables and require redeployment when changed.

To generate the two secrets locally (after npm install):

```bash
node scripts/totp.cjs
```

Copy the generated `DEV_TOTP_SECRET` into a new **time-based** account in Google Authenticator (manual setup key), then place the same secret and generated `SESSION_SECRET` in Vercel environment settings. Set your own `DEV_PASSWORD`. Do not commit or share any of these values. Test a current code at `/coming-soon`.

## 3. Build the Windows EXE, Android APK, unsigned iOS IPA with GitHub Actions

Once the production HTTPS website is deployed, open GitHub → your repository → Actions → **Build Sephora native apps** → Run workflow. Set `site_url` to your deployed HTTPS origin (for example `https://your-project.vercel.app`). The workflow compiles on Windows, Linux/Android and macOS/iOS runners. Download the outputs in the workflow's Artifacts section after successful completion:

- `Sephora-Windows`: Electron NSIS `.exe` installer (unsigned; Windows may show SmartScreen warnings).
- `Sephora-Android-APK`: debug-signed `.apk` for sideloading/testing (not a Play Store release).
- `Sephora-iOS-unsigned`: `.ipa` assembled from an unsigned device `.app`, not directly installable on a standard iPhone until correctly signed with an Apple certificate and provisioning profile. It is not an App Store release.

The native applications are dedicated webview/desktop clients of your HTTPS Sephora deployment, not independent offline AI engines. They retain local browser/webview storage on each device, and voice requires microphone permission and platform support. The iOS and Android wrappers use Capacitor's remote-server configuration; this is suitable for private/testing distribution, but an app-store release should package a local front end, use a separately secured API, and complete platform-specific review/signing. The Windows client restricts navigation and native permissions to the configured origin. There is no guarantee that a store will accept a wrapper. Local Windows/Android/iOS builds can also be done with the same npm scripts, Gradle and Xcode, respectively. GitHub Actions runner time may be chargeable.

## 4. Your approved model catalog

`models.json` is derived exclusively from the supplied library catalog snapshot dated 2026-11-12 (63 text/chat and 3 image models). The two explicitly requested Whisper IDs and the explicitly requested OpenRouter voice model are also configured. The app shows the catalog status as a historical indicator, not a live health check. It never silently changes the user's chosen chat model. Some IDs contain `free` but the source catalog does not establish free usage or current pricing; verify in the provider account.

Default chat: `community/morriszdweck/glm-5.3-flash-free`. Your catalog marked it `down`; it remains the default by request. If it fails, choose an alternative from the selector (healthy entries in your snapshot include `community/chirag-gamer/gpt-oss-120b`, `community/CloudCompile/nvidia-nemotron-3-ultra-550b-a55b:free`, and `community/pollinations-ai/floret`). Image generation defaults to the catalog's degraded SDXL model; alternatives are available in Settings. No live claims are made. The vision fallback was also marked degraded. Change model settings if needed.

## 5. Implementation details

- Landing and chat use distinct layouts, with a chrome send button, gradient glow, dark/light appearances, glass notes panel, responsive drawer, and voice orb driven by actual audio amplitude.
- The browser sends selected chat model and context to the server. The server uses Pollinations OpenAI-compatible `POST /v1/chat/completions`, forwards real streaming deltas as NDJSON, assembles tool-call fragments, executes a restricted arithmetic tool, and handles image-generation requests via structured tool events. Models that reject tools are retried without tools on compatible errors; the prompt-marker image fallback is available. Tool image markers are rendered at their position, with the supplied Behance loading GIF, and final images are stored locally. GIF availability depends on the external CDN; a local text loading indicator remains visible. Tool support and real streaming depend on model capabilities. No separate web-search provider or live DeepSearch tool is configured.
- Voice: microphone RMS detection with echo cancellation, automatic speech turn detection (or manual Speak now / Send voice), primary `community/Saauf/whisper-large-v3-turbo` then `community/Saauf/whisper-large-v3`, then selected chat model. TTS begins after the final response is received. OpenRouter endpoint `POST https://openrouter.ai/api/v1/audio/speech` with `fish-audio/s2.1-pro-free:free`; MP3 is requested. A real audio analyser drives the orb. Interruption cancels the in-flight operation and pauses/clears playback. Human audio meter displays only on the user's turn; voice messages and synthesized audio are stored with the conversation. The voice is presented as English-only, with a warning for other languages. Acoustic echo, silence thresholds, browser microphone support, and upstream transcription quality can affect natural interruption and accuracy; use manual controls if needed.
- Files: originals are retained locally (20 MB each, max six per turn); text, common code formats, DOCX, XLSX and text PDF are extracted locally. PDF extraction limits to 30 pages, spreadsheet to 500 rows/50 columns per sheet and context 30,000 characters per file. Image data is compressed; vision-capable chat models receive image parts; other models can receive fallback vision descriptions. Video analysis samples three frames and attempts audio decoding and transcription in segments (up to six minutes). Codecs vary by browser; no claim of complete video understanding, OCR for scanned PDFs, arbitrary binary analysis or perfect transcription. Large provider requests are limited by Vercel's 4.5 MB payload limit. The original unsupported file remains downloadable and the model receives an explicit unsupported-format message. A provider model might reject an otherwise documented input format.
- Markdown: GFM tables, lists, code, quotes, task lists, footnotes, LaTeX math through MathJax, code copy, and validated JSON visual bar charts in `sephora-chart` fences. The notes editor supports Markdown preview and local save. Responses and imports are untrusted: raw HTML is not enabled.
- IndexedDB persists chats, all response versions, attachment originals, audio, preferences, and notes. Backup JSON contains private data in plaintext; protect it. Import merges conversations and can restore settings. Delete a user turn deletes its associated assistant versions and media, without deleting unrelated turns. Regeneration creates a new version using preceding chat context; later existing turns are not automatically regenerated. Local deletion does not erase provider logs or external storage. Native devices have separate local databases; no automatic cross-device sync.
- Security: server-only provider keys, model allowlisting, restricted tools, basic per-instance throttling, same-origin POST checking, signed HttpOnly session cookies and TOTP. Basic in-memory throttling is not a distributed production abuse control; add Vercel Firewall/rate limits, account authentication or an upstream budget cap before enabling public access. TOTP secrets are not generated in a browser or stored in a public file. A six-digit TOTP is valid during its time window and may be reused until expiry (not a replay-proof enterprise MFA system). Keep dependencies up to date and audit before launch. Community providers may process/log your input; do not send sensitive material without reviewing their privacy policy.

Official API docs: https://gen.pollinations.ai/ and https://openrouter.ai/docs ; deployment limits: https://vercel.com/docs/functions/limitations .
