import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAnalyzeApi, handleCombinedAnalyzeApi, handleChatApi, handleTtsApi, handleExtractRemediesApi, handleDeepenChapterApi, handleTranslateContentApi, handleBlcPlanApi, handleBlcFormatLiteralApi } from './src/server/apiHandlers';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // POST /api/analyze
  app.post('/api/analyze', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleAnalyzeApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/analyze:', error);
      const status = error?.status || 500;
      const is503 = status === 503 || error?.message?.includes('503');
      const message = is503
        ? 'The Gemini AI model is experiencing temporary high demand. Please try again in a few seconds.'
        : error?.message || 'An error occurred during book analysis.';
      res.status(status).json({ error: message });
    }
  });

  // POST /api/combined-analyze
  app.post('/api/combined-analyze', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleCombinedAnalyzeApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/combined-analyze:', error);
      const status = error?.status || 500;
      const is503 = status === 503 || error?.message?.includes('503');
      const message = is503
        ? 'The Gemini AI model is experiencing temporary high demand. Please try again in a few seconds.'
        : error?.message || 'An error occurred during combined document analysis.';
      res.status(status).json({ error: message });
    }
  });

  // POST /api/deepen-chapter
  app.post('/api/deepen-chapter', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleDeepenChapterApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/deepen-chapter:', error);
      const status = error?.status || 500;
      res.status(status).json({ error: error?.message || 'An error occurred during chapter deep-dive analysis.' });
    }
  });

  // POST /api/extract-remedies
  app.post('/api/extract-remedies', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleExtractRemediesApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/extract-remedies:', error);
      const status = error?.status || 500;
      const is503 = status === 503 || error?.message?.includes('503');
      const message = is503
        ? 'The AI model is experiencing high demand. Please try extracting again in a few seconds.'
        : error?.message || 'An error occurred during remedy extraction.';
      res.status(status).json({ error: message });
    }
  });

  // POST /api/chat
  app.post('/api/chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleChatApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/chat:', error);
      const status = error?.status || 500;
      const is503 = status === 503 || error?.message?.includes('503');
      const message = is503
        ? 'The AI Assistant is currently experiencing high demand. Please try sending your question again in a moment.'
        : error?.message || 'An error occurred during chat.';
      res.status(status).json({ error: message });
    }
  });

  // POST /api/tts
  app.post('/api/tts', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleTtsApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/tts:', error);
      const status = error?.status || 500;
      const is503 = status === 503 || error?.message?.includes('503');
      const message = is503
        ? 'The voice synthesis model is temporarily experiencing high traffic. Please try playing the audio summary again in a few seconds.'
        : error?.message || 'An error occurred during speech synthesis.';
      res.status(status).json({ error: message });
    }
  });

  // POST /api/translate-content
  app.post('/api/translate-content', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleTranslateContentApi(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/translate-content:', error);
      const status = error?.status || 500;
      res.status(status).json({ error: error?.message || 'An error occurred during content translation.' });
    }
  });

  // POST /api/blc-plan
  app.post('/api/blc-plan', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleBlcPlanApi(req.body);
      res.json(result);
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      const rawMsg = String(error?.message || 'An error occurred while generating the BLC session curriculum.').replace(/\s+/g, ' ').trim();
      console.error(`Error in /api/blc-plan [${status}]: ${rawMsg}`);
      const is503 = status === 503 || rawMsg.includes('503');
      const is429 = status === 429 || rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota');
      const message = is503
        ? 'The Gemini AI model is experiencing temporary high demand. Please retry generating this batch in a few seconds.'
        : is429
        ? 'Gemini API rate limit or quota reached. Please wait a few moments and retry.'
        : rawMsg;
      res.status(status).json({ error: message });
    }
  });

  // POST /api/blc-format-literal
  app.post('/api/blc-format-literal', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await handleBlcFormatLiteralApi(req.body);
      res.json(result);
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      const rawMsg = String(error?.message || 'An error occurred while formatting literal reading text.').replace(/\s+/g, ' ').trim();
      console.error(`Error in /api/blc-format-literal [${status}]: ${rawMsg}`);
      const is503 = status === 503 || rawMsg.includes('503');
      const is429 = status === 429 || rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota');
      const message = is503
        ? 'The Gemini AI model is experiencing temporary high demand. Please retry in a few seconds.'
        : is429
        ? 'Gemini API rate limit or quota reached. Please wait a few moments and retry.'
        : rawMsg;
      res.status(status).json({ error: message });
    }
  });

  // 404 Fallback for any unhandled /api/* routes to prevent returning HTML index.html
  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found.` });
  });

  // Mount Vite or Static middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wisdom Reader server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Wisdom Reader server:', err);
  process.exit(1);
});
