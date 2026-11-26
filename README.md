# MR-WINE-MD

Original starter for a WhatsApp Multi-Device bot using Baileys. This is a starter build, not a claim that every command in the supplied KAMRAN-MD menu is already implemented.

## Requirements
- Node.js 20+
- A WhatsApp account you control
- Persistent storage for `/data/auth` in production

## Run locally
1. Copy `.env.example` to `.env` and fill in `OWNER_NUMBER` and `PAIRING_NUMBER` (international digits only).
2. Run `npm install`.
3. Run `npm start`.
4. The pairing code is printed in the runtime logs. Alternatively, scan the QR printed in the terminal.

## Railway deployment
1. Push this folder to a private GitHub repository.
2. In Railway, create a project from that GitHub repository.
3. Add a Volume and mount it at `/data`.
4. Add Variables: `OWNER_NUMBER`, `PAIRING_NUMBER`, `PREFIX`, `AUTH_DIR=/data/auth`, and optionally `OPENAI_API_KEY`, `OPENAI_MODEL`.
5. Deploy with start command `npm start`.
6. Keep the volume attached; it stores WhatsApp authentication. Do not publish or share its contents.

## Implemented commands
`.menu`, `.ping`, `.alive`, `.runtime`, `.owner`, `.ai`, `.time`, `.tagall` (group admins only), `.calc`.

The remaining categories and integrations from the requested command list are not implemented yet. Downloader, news, anime, image, audio, and other external-service commands require individual safe integrations and testing.

## Safety
Do not use this bot for spam, harassment, credential theft, payment-card fraud, or non-consensual sexual content. Baileys is an unofficial WhatsApp Web integration and may carry account restriction risk. Use a number you control and follow WhatsApp terms.
