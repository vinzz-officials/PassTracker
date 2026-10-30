import {
  extractHints,
  exactMatch
} from '../lib/parser.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2kb'
    }
  }
};

const MAX_HTML_SIZE = 2 * 1024 * 1024;

function sendEvent(res, event, data) {
  if (res.writableEnded) return;

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return 'unknown';
}

async function notifyAdmin({
  req,
  hint,
  matched
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const ip = getClientIP(req);

  const message = [
    'NOIR TRACKER',
    '',
    `IP: ${ip}`,
    `Hint: ${hint}`,
    `Result: ${matched ? 'MATCH' : 'NO MATCH'}`,
    `Time: ${new Date().toISOString()}`
  ].join('\n');

  try {
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        }),
        signal: AbortSignal.timeout(8000)
      }
    );
  } catch (error) {
    console.error('Telegram notification failed:', error.message);
  }
}

async function fetchSource() {
  const sourceURL = process.env.SOURCE_URL;

  if (!sourceURL) {
    throw new Error('SOURCE_URL belum diatur.');
  }

  const url = new URL(sourceURL);

  if (url.protocol !== 'https:') {
    throw new Error('SOURCE_URL harus menggunakan HTTPS.');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NOIR-Hint-Tracker/1.0',
      'Accept': 'text/html'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Source HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    throw new Error('Source bukan halaman HTML.');
  }

  const html = await response.text();

  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_SIZE) {
    throw new Error('Ukuran HTML melebihi batas 2 MB.');
  }

  return html;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { hint, consent } = req.body || {};

  if (typeof hint !== 'string' || !hint.trim()) {
    return res.status(400).json({
      error: 'Hint tidak boleh kosong.'
    });
  }

  if (hint.length > 1000) {
    return res.status(400).json({
      error: 'Hint terlalu panjang.'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders?.();

  try {
    sendEvent(res, 'log', {
      message: 'NOIR engine initialized.'
    });

    sendEvent(res, 'log', {
      message: 'Connecting to source...'
    });

    const html = await fetchSource();

    sendEvent(res, 'log', {
      message: 'Source connected.'
    });

    sendEvent(res, 'log', {
      message: 'Parsing HTML document...'
    });

    const hints = extractHints(html);

    sendEvent(res, 'log', {
      message: `Found ${hints.length} hint entries.`
    });

    sendEvent(res, 'log', {
      message: 'Performing exact hint comparison...'
    });

    const matched = exactMatch(hint, hints);

    sendEvent(res, 'log', {
      message: matched
        ? 'Exact hint match found.'
        : 'No exact hint match.'
    });

    if (consent === true) {
      sendEvent(res, 'log', {
        message: 'Sending consented telemetry...'
      });

      await notifyAdmin({
        req,
        hint,
        matched: Boolean(matched)
      });
    }

    sendEvent(res, 'result', {
      success: true,
      matched: Boolean(matched),
      message: matched
        ? 'Hint cocok.'
        : 'Hint tidak ditemukan.'
    });

    res.end();
  } catch (error) {
    sendEvent(res, 'error', {
      message: error.message || 'Internal server error.'
    });

    res.end();
  }
}
