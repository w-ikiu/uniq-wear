require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const httpRequestsTotal = {};

app.use((req, res, next) => {
  res.on('finish', () => {
    const key = `${req.method}:${res.statusCode}`;
    httpRequestsTotal[key] = (httpRequestsTotal[key] || 0) + 1;
  });
  next();
});

app.get('/metrics', (req, res) => {
  let out = '';
  out += '# HELP process_uptime_seconds process uptime\n';
  out += '# TYPE process_uptime_seconds gauge\n';
  out += `process_uptime_seconds ${process.uptime().toFixed(2)}\n`;
  out += '# HELP process_memory_bytes resident memory\n';
  out += '# TYPE process_memory_bytes gauge\n';
  out += `process_memory_bytes ${process.memoryUsage().rss}\n`;
  out += '# HELP http_requests_total total http requests\n';
  out += '# TYPE http_requests_total counter\n';
  for (const [key, val] of Object.entries(httpRequestsTotal)) {
    const [method, status] = key.split(':');
    out += `http_requests_total{method="${method}",status="${status}"} ${val}\n`;
  }
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(out);
});

// adresy serwisow (w dockerze uzywamy nazw kontenerow)
const CATALOG_URL = process.env.CATALOG_URL || 'http://localhost:3001';
const CHECKOUT_URL = process.env.CHECKOUT_URL || 'http://localhost:3002';

// t8b: api gateway - przekierowanie ruchu do odpowiednich serwisow

// wszystkie zadania do /catalog/* ida do catalog-service
app.use('/catalog', createProxyMiddleware({
  target: CATALOG_URL,
  changeOrigin: true,
  // usuwamy prefix /catalog z url przed przekazaniem
  // np. /catalog/api/products → /api/products
  pathRewrite: { '^/catalog': '' }
}));

// wszystkie zadania do /checkout/* ida do checkout-service
app.use('/checkout', createProxyMiddleware({
  target: CHECKOUT_URL,
  changeOrigin: true,
  // np. /checkout/api/cart → /api/cart
  pathRewrite: { '^/checkout': '' }
}));

// health check samego gateway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    services: {
      catalog: CATALOG_URL,
      checkout: CHECKOUT_URL
    }
  });
});

const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  console.log(`api gateway dziala na porcie ${PORT}`);
  console.log(`- /catalog/* → ${CATALOG_URL}`);
  console.log(`- /checkout/* → ${CHECKOUT_URL}`);
});