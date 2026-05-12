# INR Currency Signal Dashboard

This is a Vite + React app ready for Vercel.

## What changed from the single `.jsx` file
- Added a full React app scaffold
- Moved live USD/INR fetching into Vercel API routes
- Added build config for Vercel
- Added an environment variable for your Anthropic API key

## Local setup
```bash
npm install
cp .env.example .env
# add your key to .env
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add `ANTHROPIC_API_KEY` in Vercel Project Settings -> Environment Variables.
4. Deploy.

## Notes
- `api/latest-rate.js` and `api/history20.js` are serverless endpoints.
- If the API key is missing, the history endpoint falls back to sample data so the UI still loads.
