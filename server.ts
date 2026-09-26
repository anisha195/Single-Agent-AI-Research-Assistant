/**
 * Server entry point for Single-Agent AI Research Assistant.
 * Provides REST & SSE APIs for autonomous research, document ingestion,
 * and serves the React frontend via Vite in dev or static dist in prod.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ResearchAgent } from './server/agent.js';
import { vectorStore } from './server/rag.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Initialize vector store on startup
vectorStore.initialize().catch((err) => {
  console.error('Failed to initialize vector store:', err);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Single-Agent AI Research Assistant',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Document store status endpoint
app.get('/api/documents', (req, res) => {
  try {
    const status = vectorStore.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Document re-ingestion endpoint
app.post('/api/ingest', async (req, res) => {
  try {
    const status = await vectorStore.ingestAll();
    res.json({
      message: 'Documents ingested successfully',
      status,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Core Research Endpoint: Supports both standard JSON and Server-Sent Events (SSE)
app.post('/api/research', async (req, res) => {
  const query = req.body?.query;
  const wantsStream = req.query.stream === 'true' || req.headers.accept === 'text/event-stream';

  if (!query || typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Missing or invalid "query" parameter in request body.' });
    return;
  }

  const agent = new ResearchAgent();

  if (wantsStream) {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent('start', { query });

      const result = await agent.runResearch(query, (step) => {
        sendEvent('step', step);
      });

      sendEvent('complete', result);
      res.end();
    } catch (err: any) {
      sendEvent('error', { error: err?.message || 'Agent error during research' });
      res.end();
    }
  } else {
    // Standard synchronous JSON response
    try {
      const result = await agent.runResearch(query);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Internal research assistant error',
      });
    }
  }
});

// Vite Middleware integration for development
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Research Assistant] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
