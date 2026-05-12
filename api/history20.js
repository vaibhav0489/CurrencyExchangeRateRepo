import { json, getApiKey, parseAnthropicText, todayStr } from './_helpers.js';

function fallbackHistory() {
  const today = new Date();
  const out = [];
  let rate = 83.8;
  for (let i = 19; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    rate += (Math.random() - 0.5) * 0.18;
    out.push({ date: d.toISOString().split('T')[0], rate: Number(rate.toFixed(4)), ts: Date.now() });
  }
  return out;
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return json(200, { history: fallbackHistory(), source: 'fallback' });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'Search for USD to INR exchange rate history for the past 20 trading days. Return ONLY valid JSON array: [{"date":"YYYY-MM-DD","rate":85.00}, ...]. Include exactly 20 entries sorted oldest to newest.',
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json(res.status, { error: `Anthropic API ${res.status}${text ? `: ${text}` : ''}` });
    }

    const data = await res.json();
    const text = parseAnthropicText(data);
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return json(500, { error: 'Could not parse history from model response' });
    const arr = JSON.parse(match[0]);
    const history = arr
      .filter((e) => e?.date && e?.rate)
      .map((e) => ({ date: e.date, rate: Number.parseFloat(e.rate), ts: Date.now() }))
      .filter((e) => Number.isFinite(e.rate));

    return json(200, { history, source: 'web search', today: todayStr() });
  } catch (err) {
    return json(500, { error: err?.message || 'Unexpected error' });
  }
}
