require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

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