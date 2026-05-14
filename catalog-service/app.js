require('dotenv').config();

const { query } = require('./db');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const knex = require('./knex-client');
const { connectToMongo, getClient } = require('./mongo-client');

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
      return res.status(404).json({ error: 'nie znaleziono produktu', code: 404, details: null });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    // t1: jednolity format bledow mapowanych z postgresa
    const status = error.status || 500;
    res.status(status).json({ 
      error: error.message,
      code: status,
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
    res.status(500).json({ error: 'blad serwera', code: 500, details: error.message });
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

    return res.status(404).json({ error: 'nie znaleziono produktu', code: 404, details: null });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'blad prismy', code: 500, details: error.message });
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
    res.status(500).json({ error: 'blad statystyk', code: 500, details: error.message });
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
    res.status(500).json({ error: error.message, code: 500, details: null });
  }
});

// t5: trzeci operator mongodb - $in (pobieranie szczegolów wielu produktów naraz)
app.get('/api/products/details', async (req, res) => {
  try {
    const db = await connectToMongo();
    
    // ids przychodzi jako ?ids=1,2,3
    const ids = req.query.ids
      ? req.query.ids.split(',').map(Number)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ 
        error: 'brak parametru ids', 
        code: 400, 
        details: 'podaj ids jako ?ids=1,2,3' 
      });
    }

    // t5: operator $in - znajdz dokumenty gdzie productId jest w podanej liscie
    const details = await db.collection('productdetails').find({
      productId: { $in: ids }
    }).toArray();

    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message, code: 500, details: null });
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
      body: req.body.body,
      status: req.body.status
    });
    
    // save() automatycznie uruchamia walidatory i nasz pre-hook (cenzure)
    await review.save(); 
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message, code: 400, details: null });
  }
});

// t6: polaczenie z mongodb przez mongoose przy starcie aplikacji
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('polaczono z mongodb przez mongoose'))
  .catch(err => console.error('blad polaczenia z mongodb:', err));

// t7: agregacja pipeline
app.get('/api/analytics/ratings', async (req, res) => {
  try {
    const pipeline = [
      // 1. $match (wymog T7: filtrowanie uzywajace indeksu na pole 'status')
      { $match: { status: 'approved' } },
      
      // 2. $group (wymog T7: grupowanie po produkcie i liczenie sredniej oraz ilosci)
      { 
        $group: {
          _id: "$productId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 }
        }
      },
      
      // 3. $lookup (wymog T7: zlaczenie z kolekcja productdetails - nazwa jest z malych liter z 's' na koncu przez mongoose)
      {
        $lookup: {
          from: "productdetails", 
          localField: "_id",
          foreignField: "productId",
          as: "details"
        }
      },
      
      // 4. dodatkowy stage 1: $unwind (rozpakowanie tablicy details utworzonej przez lookup)
      { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },
      
      // 5. dodatkowy stage 2: $sort (sortowanie od najlepiej ocenianych)
      { $sort: { averageRating: -1 } },
      
      // 6. $project (wymog T7: rzutowanie/formatowanie koncowego wyniku)
      {
        $project: {
          _id: 0,
          productId: "$_id",
          averageRating: { $round: ["$averageRating", 2] },
          reviewCount: 1,
          description: "$details.long_description"
        }
      }
    ];

    // uruchomienie agregacji bezposrednio w bazie mongodb
    const results = await Review.aggregate(pipeline);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message, code: 500, details: null });
  }
});

// t8c: architektura hybrydowa - zapis do pg i mongo z kompensacja
app.post('/api/products/hybrid', async (req, res) => {
  const { name, description, categoryId, price, sku, longDescription } = req.body;
  let createdProductPg;

  try {
    // 1. zapis do postgresql (przez prisma)
    createdProductPg = await prisma.product.create({
      data: {
        name,
        description,
        categoryId: parseInt(categoryId),
        variants: {
          create: { sku, price: parseFloat(price), stock: 0 }
        }
      }
    });

    // 2. zapis do mongodb (przez mongoose)
    try {
      const details = new ProductDetails({
        productId: createdProductPg.id,
        long_description: longDescription,
        gallery: []
      });
      await details.save();
      
      res.status(201).json({
        message: 'produkt utworzony w obu bazach',
        pg: createdProductPg,
        mongo: details
      });

    } catch (mongoError) {
      // t8c: kompensacja - jesli mongo zawiedzie, usuwamy rekord z postgresa
      console.error('blad mongo, uruchamiam kompensacje w postgres...');
      await prisma.product.delete({ where: { id: createdProductPg.id } });
      
      throw new Error('blad zapisu detali produktu, operacja wycofana.');
    }

  } catch (error) {
    const status = error.message.includes('wycofana') ? 500 : 400;
    res.status(status).json({
      error: 'blad tworzenia hybrydowego',
      code: status,
      details: error.message
    });
  }
});

const PORT = process.env.CATALOG_PORT || 3001;
app.listen(PORT, () => {
  console.log(`catalog service dziala na porcie ${PORT}`);
});

// timeout na zamykanie serwera (problemy z dzialaniem ctrl + c)
process.on('SIGINT', async () => {
  console.log('\nodebrano sygnal zamkniecia.');

  // 1. ustawiamy bezpiecznik - po 2 sekundach bezwzglednie zabijamy proces
  setTimeout(() => {
    console.error('timeout - wymuszone zabicie procesu');
    process.exit(0);
  }, 2000);

  // 2. probujemy kulturalnie zamknac polaczenia
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('- mongoose zamkniety');
    }
    await prisma.$disconnect();
    console.log('- prisma zamknieta');
    
    // natywny klient z t5
    const nativeClient = getClient();
    if (nativeClient) {
      await nativeClient.close();
      console.log('- natywne mongo zamkniete');
    }
    
    console.log('wszystko zamkniete');
    process.exit(0);
  } catch (err) {
    console.error('blad przy zamykaniu:', err);
    process.exit(1);
  }
});