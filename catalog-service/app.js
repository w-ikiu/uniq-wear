require('dotenv').config();

const { query } = require('./db');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const knex = require('./knex-client');
const { connectToMongo } = require('./mongo-client');

const mongoose = require('mongoose');
const Review = require('./models/Review');
const ProductDetails = require('./models/ProductDetails');

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

// t5: zasob domenowy sterownikiem natywnym (szukanie w detalach po tekscie i filtracja specyfikacji)
app.get('/api/products/details/search', async (req, res) => {
  try {
    const { keyword, minWeight } = req.query;
    const db = await connectToMongo();
    
    // t5: uzycie min. 3 roznych operatorow: $text, $search, $gte
    let query = {};
    
    if (keyword) {
      query.$text = { $search: keyword };
    }
    
    if (minWeight) {
      // zakladamy ze np waga buta jest w specyfikacji jako liczba (np '300')
      // $gte = greater than or equal
      query['specs.weight'] = { $gte: parseInt(minWeight) }; 
    }

    // surowe zapytanie przez kolekcje
    const details = await db.collection('productdetails').find(query).toArray();
    
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// t6: endpoint do dodawania recenzji i testowania hookow (mongoose)
app.post('/api/reviews', async (req, res) => {
  try {
    const review = new Review({
      productId: req.body.productId,
      userId: req.body.userId,
      rating: req.body.rating,
      title: req.body.title,
      body: req.body.body
    });
    
    // save() automatycznie uruchamia walidatory i nasz pre-hook (cenzure)
    await review.save(); 
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// t6: polaczenie z mongodb przez mongoose przy starcie aplikacji
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('polaczono z mongodb przez mongoose'))
  .catch(err => console.error('blad polaczenia z mongodb:', err));

const PORT = process.env.CATALOG_PORT || 3001;
app.listen(PORT, () => {
  console.log(`catalog service dziala na porcie ${PORT}`);
});