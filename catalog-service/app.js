const { query } = require('./db');
require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const knex = require('./knex-client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// t1: endpoint uzywajacy natywnego sterownika z parametryzacja zapytania
app.get('/api/products/pg/:id', async (req, res) => {
  try {
    // uzywamy $1 zamiast wklejac id - to chroni przed sql injection
    const result = await query('SELECT * FROM "Product" WHERE id = $1', [parseInt(req.params.id)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'nie znaleziono produktu' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    // t1: jednolity format bledow mapowanych z postgresa
    res.status(error.status || 500).json({ 
      error: error.message, 
      details: error.details 
    });
  }
});

// t2: endpoint z dynamicznym where bez sklejania stringow
app.get('/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice } = req.query;

    // budowanie dynamicznego zapytania knex
    const query = knex('Product')
      .select('Product.*', 'Category.name as categoryName')
      .join('Category', 'Product.categoryId', 'Category.id');

    if (category) {
      query.where('Category.name', category);
    }

    if (minPrice) {
      // uzywamy variantow do filtrowania po cenie
      query.whereExists(function() {
        this.select('*')
          .from('Variant')
          .whereRaw('"Variant"."productId" = "Product"."id"')
          .andWhere('price', '>=', parseFloat(minPrice));
      });
    }

    const products = await query;
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'blad serwera', details: error.message });
  }
});

// t4: crud przez prismaclient - pobieranie szczegolow z relacjami
app.get('/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        category: true,
        variants: true
      }
    });

    if (!product) return res.status(404).json({ error: 'nie znaleziono produktu' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'blad prismy', details: error.message });
  }
});

// t4: min. 1 $queryraw (tagged template literal) - statystyki magazynowe
app.get('/stats/inventory', async (req, res) => {
  try {
    // parametryzacja dla bezpieczenstwa (zapobiega sql injection)
    const minStock = parseInt(req.query.minStock || 0);
    
    // surowe zapytanie sql z tagged template literal
    const stats = await prisma.$queryRaw`
      SELECT p."categoryId", SUM(v.stock) as "totalStock"
      FROM "Variant" v
      JOIN "Product" p ON v."productId" = p.id
      WHERE v.stock >= ${minStock}
      GROUP BY p."categoryId"
    `;

    // funkcja sum() w postgresie zwraca typ bigint, ktory nie parsuje sie domyslnie w json
    // musimy zmapowac bigint na zwykly numer
    const formattedStats = stats.map(stat => ({
      categoryId: stat.categoryId,
      totalStock: Number(stat.totalStock)
    }));

    res.json(formattedStats);
  } catch (error) {
    res.status(500).json({ error: 'blad statystyk', details: error.message });
  }
});

const PORT = process.env.CATALOG_PORT || 3001;
app.listen(PORT, () => {
  console.log(`catalog service dziala na porcie ${PORT}`);
});