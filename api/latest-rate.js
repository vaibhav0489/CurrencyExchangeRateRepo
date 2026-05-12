import { json, getApiKey, parseAnthropicText, todayStr } from './_helpers.js';

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return json(500, { error: 'Missing ANTHROPIC_API_KEY in environment variables' });
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
        max_tokens: 300,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'Search for the current USD to INR exchange rate right now. Return ONLY valid JSON: {"rate": <number>, "date": "YYYY-MM-DD", "source": "<source name>"}',
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json(res.status, { error: `Anthropic API ${res.status}${text ? `: ${text}` : ''}` });
    }

    const data = await res.json();
    const text = parseAnthropicText(data);
    const match = text.match(/\{[\s\S]*?"rate"[\s\S]*?\}/);
    if (!match) return json(500, { error: 'Could not parse rate from model response' });
    const parsed = JSON.parse(match[0]);
    const rate = Number.parseFloat(parsed.rate);
    if (!Number.isFinite(rate)) return json(500, { error: 'Invalid rate value' });

    return json(200, {
      rate,
      date: parsed.date || todayStr(),
      source: parsed.source || 'web search',
      ts: Date.now(),
    });
  } catch (err) {
    return json(500, { error: err?.message || 'Unexpected error' });
  }
}
