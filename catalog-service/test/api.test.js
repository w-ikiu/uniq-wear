const request = require('supertest');

const BASE_URL = 'http://localhost:3001';

describe('Catalog Service - testy integracyjne', () => {

  // test 1: tworzenie produktu hybrydowego (t8c)
  describe('POST /api/products/hybrid', () => {
    it('powinno utworzyc produkt w obu bazach (PG + Mongo)', async () => {
      // najpierw tworzymy kategorie
      const catResponse = await request(BASE_URL)
        .post('/api/categories')
        .send({ name: 'test-kat-' + Date.now() });

      const categoryId = catResponse.body.id;

      const response = await request(BASE_URL)
        .post('/api/products/hybrid')
        .send({
          name: 'Test But Catalog',
          description: 'But testowy',
          categoryId: categoryId,
          price: 199.99,
          sku: 'CAT-TEST-' + Date.now(),
          longDescription: 'Dlugi opis testowy buta katalogowego',
          stock: 10
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('pg');
      expect(response.body).toHaveProperty('mongo');
      expect(response.body.pg).toHaveProperty('id');
      expect(response.body.mongo).toHaveProperty('_id');
    });

    it('powinno zwrocic blad gdy brak wymaganych pol', async () => {
      const response = await request(BASE_URL)
        .post('/api/products/hybrid')
        .send({
          name: 'Niekompletny produkt'
          // brak categoryId, price, sku, longDescription
        });

      expect([400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });
  });

  // test 2: dodawanie recenzji (t6 - walidacja mongoose)
  describe('POST /api/reviews', () => {
    it('powinno dodac recenzje z poprawna ocena', async () => {
      const response = await request(BASE_URL)
        .post('/api/reviews')
        .send({
          productId: 1,
          userId: 1,
          rating: 5,
          title: 'Swietny produkt',
          body: 'Bardzo polecam ten produkt wszystkim'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('powinno odrzucic recenzje z niepoprawna ocena', async () => {
      const response = await request(BASE_URL)
        .post('/api/reviews')
        .send({
          productId: 1,
          userId: 1,
          rating: 10, // za wysoka ocena - max to 5
          title: 'Zla ocena',
          body: 'To nie powinno przejsc walidacji'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // test 3: lista produktow z filtrem (t2 - dynamiczny where)
  describe('GET /products', () => {
    it('powinno zwrocic liste produktow', async () => {
      const response = await request(BASE_URL)
        .get('/api/products');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('powinno filtrowac produkty po kategorii', async () => {
      const response = await request(BASE_URL)
        .get('/api/products?category=sneakers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // test 4: agregacja ocen (t7)
  describe('GET /api/analytics/ratings', () => {
    it('powinno zwrocic agregacje ocen', async () => {
      const response = await request(BASE_URL)
        .get('/api/analytics/ratings');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // test 5: format bledow
  describe('Format bledow', () => {
    it('bledy powinny miec format { error, code, details }', async () => {
      const response = await request(BASE_URL)
        .get('/api/products/pg/99999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 404);
    });
  });
});