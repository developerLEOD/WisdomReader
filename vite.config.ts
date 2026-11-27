import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
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
} from './src/server/apiHandlers';

async function getJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
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
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));

    // If stream already ended
    if (req.readableEnded || req.complete) {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch (e) {
        resolve({});
      }
    }
  });
}

function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json');

          try {
            const parsedBody = await getJsonBody(req);

            if (url.startsWith('/api/analyze') && req.method === 'POST') {
              const result = await handleAnalyzeApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/combined-analyze') && req.method === 'POST') {
              const result = await handleCombinedAnalyzeApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/deepen-chapter') && req.method === 'POST') {
              const result = await handleDeepenChapterApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/extract-remedies') && req.method === 'POST') {
              const result = await handleExtractRemediesApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/chat') && req.method === 'POST') {
              const result = await handleChatApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/tts') && req.method === 'POST') {
              const result = await handleTtsApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/translate-content') && req.method === 'POST') {
              const result = await handleTranslateContentApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/blc-plan') && req.method === 'POST') {
              const result = await handleBlcPlanApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/blc-format-literal') && req.method === 'POST') {
              const result = await handleBlcFormatLiteralApi(parsedBody);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
              return;
            }

            if (url.startsWith('/api/health')) {
              res.statusCode = 200;
              res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
              return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ error: `API route ${req.method} ${url} not found.` }));
          } catch (err: any) {
            console.error('API Dev Plugin error:', err);
            const status = err?.status || 500;
            const is503 = status === 503 || err?.message?.includes('503');
            const message = is503
              ? 'The Gemini AI model is experiencing temporary high demand. Please try again in a few seconds.'
              : err?.message || 'An error occurred during API processing.';
            res.statusCode = status;
            res.end(JSON.stringify({ error: message }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
