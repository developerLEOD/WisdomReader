import {
  handleAnalyzeApi,
  handleCombinedAnalyzeApi,
  handleChatApi,
  handleTtsApi,
  handleExtractRemediesApi,
  handleDeepenChapterApi,
  handleTranslateContentApi,
  handleBlcPlanApi,
  handleBlcFormatLiteralApi,
} from './apiHandlers';

async function getJsonBody(req: any): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf8'));
      } catch {
        return {};
      }
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return req.body ? JSON.parse(req.body) : {};
      } catch {
        return {};
      }
    }
  }

  return new Promise((resolve) => {
    let bodyData = '';
    req.on('data', (chunk: any) => {
      bodyData += chunk;
    });
    req.on('end', () => {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));

    if (req.readableEnded || req.complete) {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch {
        resolve({});
      }
    }
  });
}

function resolveApiPath(req: any): string {
  const rawUrl = typeof req.url === 'string' && req.url.startsWith('/') ? req.url : '/';
  const urlObj = new URL(rawUrl, 'http://localhost');
  const routeParam = req.query?.__route ?? urlObj.searchParams.get('__route');
  const rawRoute = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  const pathname = rawRoute
    ? `/api/${String(rawRoute).replace(/^\/+/, '')}`
    : urlObj.pathname;

  return pathname.replace(/\/+$/, '') || '/api';
}

function sendJson(res: any, statusCode: number, payload: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  let pathname = '/api';

  try {
    const method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    pathname = resolveApiPath(req);

    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'ok', timestamp: Date.now() });
    }

    if (method !== 'POST') {
      return sendJson(res, 404, { error: `API endpoint ${method} ${pathname} not found.` });
    }

    const body = await getJsonBody(req);

    switch (pathname) {
      case '/api/analyze': {
        const result = await handleAnalyzeApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/combined-analyze': {
        const result = await handleCombinedAnalyzeApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/deepen-chapter': {
        const result = await handleDeepenChapterApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/extract-remedies': {
        const result = await handleExtractRemediesApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/chat': {
        const result = await handleChatApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/tts': {
        const result = await handleTtsApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/translate-content': {
        const result = await handleTranslateContentApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/blc-plan': {
        const result = await handleBlcPlanApi(body);
        return sendJson(res, 200, result);
      }
      case '/api/blc-format-literal': {
        const result = await handleBlcFormatLiteralApi(body);
        return sendJson(res, 200, result);
      }
      default:
        return sendJson(res, 404, { error: `API endpoint ${method} ${pathname} not found.` });
    }
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    const rawMsg = String(error?.message || 'An error occurred during API processing.')
      .replace(/\s+/g, ' ')
      .trim();
    console.error(`Error in ${pathname} [${status}]: ${rawMsg}`);
    const is503 = status === 503 || rawMsg.includes('503');
    const is429 = status === 429 || rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota');
    const message = is503
      ? 'The Gemini AI model is experiencing temporary high demand. Please try again in a few seconds.'
      : is429
      ? 'Gemini API rate limit or quota reached. Please wait a few moments and retry.'
      : rawMsg;

    return sendJson(res, status, { error: message });
  }
}
