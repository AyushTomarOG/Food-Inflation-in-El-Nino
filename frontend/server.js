import express from 'express';
import { createServer as createViteServer } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const app = express();
let vite;
if (!isProd) {
  vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
  app.use(vite.middlewares);
} else {
  app.use('/assets', express.static(path.resolve(__dirname, 'dist/assets'), { maxAge: '1y', immutable: true }));
}
app.get('*', async (req, res, next) => {
  try {
    const url = req.originalUrl;
    let template, render;
    if (!isProd) {
      template = await readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render;
    } else {
      template = await readFile(path.resolve(__dirname, 'dist/index.html'), 'utf-8');
      render = (await import('./dist/server/entry-server.js')).render;
    }
    const appHtml = render();
    res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template.replace('<!--ssr-outlet-->', appHtml));
  } catch (e) {
    vite?.ssrFixStacktrace(e);
    next(e);
  }
});
const port = Number(process.env.PORT || 5173);
app.listen(port, '0.0.0.0', () => console.log(`SSR dashboard running at http://localhost:${port}`));