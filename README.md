# Augra Medical Ad Generator

A premium ad creative generation tool for medical and aesthetic practices. Powered by Claude AI for prompt crafting and FAL.ai Flux Pro for image generation.

## Setup

1. **Clone and install:**

   ```bash
   git clone <repo-url>
   cd augra-ad-generator
   npm install
   ```

2. **Add API keys:**

   Copy the example env file and fill in your keys:

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local`:

   - `ANTHROPIC_API_KEY` — Get yours at [console.anthropic.com](https://console.anthropic.com/)
   - `FAL_KEY` — Get yours at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)

3. **Run locally:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

Add `ANTHROPIC_API_KEY` and `FAL_KEY` as environment variables in your Vercel project settings, then deploy.

## How It Works

1. Fill in the 5 inputs (ad type, procedure, key message, format, optional brand note)
2. Hit **Generate**
3. Claude crafts a detailed image generation prompt using medical advertising expertise
4. FAL.ai Flux Pro v1.1 generates a photorealistic ad creative from that prompt
5. Download the result

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Anthropic SDK (Claude Sonnet 4.5)
- FAL.ai Serverless Client (Flux Pro v1.1)
