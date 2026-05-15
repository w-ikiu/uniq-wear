const request = require('supertest');

const BASE_URL = 'http://localhost:3002';
const CATALOG_URL = 'http://localhost:3001';

beforeAll(async () => {
  const catResponse = await request(CATALOG_URL)
    .post('/api/categories')
    .send({ name: 'test-kategoria-' + Date.now() });

  const categoryId = catResponse.body.id;
  console.log('categoryId:', categoryId);

  const sku = 'TEST-SKU-' + Date.now();

  const productResponse = await request(CATALOG_URL)
    .post('/api/products/hybrid')
    .send({
      name: 'Test But',
      description: 'But do testow',
      categoryId: categoryId,
      price: 100.00,
      sku: sku,
      longDescription: 'Opis testowy buta do testow automatycznych'
    });

  console.log('product response:', JSON.stringify(productResponse.body));
  global.testSku = sku;
  console.log('testSku:', global.testSku);
});

describe('Checkout Service - testy integracyjne', () => {

  describe('POST /checkout', () => {
    it('powinno zwrocic 409 gdy brak wystarczajacego stanu', async () => {
      const response = await request(BASE_URL)
        .post('/checkout')
        .send({
          items: [{ sku: global.testSku, quantity: 99999 }]
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 409);
      expect(response.body).toHaveProperty('details');
    });

    it('powinno zwrocic 404 gdy SKU nie istnieje', async () => {
      const response = await request(BASE_URL)
        .post('/checkout')
        .send({
          items: [{ sku: 'NIEISTNIEJACY-SKU-XYZ', quantity: 1 }]
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('code', 404);
    });
  });

  describe('GET /orders', () => {
    it('powinno zwrocic liste zamowien', async () => {
      const response = await request(BASE_URL)
        .get('/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/cart', () => {
    it('powinno utworzyc nowy koszyk', async () => {
      const response = await request(BASE_URL)
        .post('/api/cart')
        .send({ sessionId: 'test-session-123' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'open');
    });
  });

  describe('POST /api/cart/:id/items', () => {
    it('powinno zwrocic 409 gdy brak stanu przy dodawaniu do koszyka', async () => {
      const cartResponse = await request(BASE_URL)
        .post('/api/cart')
        .send({ sessionId: 'test-session-456' });

      const cartId = cartResponse.body.id;

      const response = await request(BASE_URL)
        .post(`/api/cart/${cartId}/items`)
        .send({ sku: global.testSku, quantity: 99999 });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('code', 409);
    });

    it('powinno zwrocic 404 gdy koszyk nie istnieje', async () => {
      const response = await request(BASE_URL)
        .post('/api/cart/99999/items')
        .send({ sku: global.testSku, quantity: 1 });

      expect(response.status).toBe(404);
    });
  });

  describe('Format bledow', () => {
    it('bledy powinny miec format { error, code, details }', async () => {
      const response = await request(BASE_URL)
        .post('/checkout')
        .send({
          items: [{ sku: 'NIEISTNIEJACY', quantity: 1 }]
        });

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('details');
    });
  });
});