require('dotenv').config();
const express = require('express');
const { sequelize, Order, OrderLine, Cart, CartLine } = require('./models');
const connectMongo = require('./config/mongo');

const app = express();
app.use(express.json());

// polaczenie z mongodb (mongoose) przy starcie serwisu
connectMongo();

// wymog specyficzny: checkout z blokada oversell
// t3: transakcja zarzadzana (sequelize.transaction)
// t3: blokada FOR UPDATE zapobiega wyscigom przy rownoczesnych zamowieniach
// regula biznesowa: snapshot ceny w order_lines (zmiana cennika nie wplywa na zlezone zamowienia)
app.post('/checkout', async (req, res) => {
  const { items, userId, cartId } = req.body;
  let createdOrder;
  let savedLines;

  try {
    // krok 1: transakcja pg - tworzenie zamowienia i odjecie stanu
    const result = await sequelize.transaction(async (t) => {
      let totalAmount = 0;
      const orderLinesData = [];

      for (const item of items) {
        const [variants] = await sequelize.query(
          `SELECT id, price, stock FROM "Variant" WHERE sku = :sku FOR UPDATE`,
          { replacements: { sku: item.sku }, transaction: t }
        );

        const variant = variants[0];
        if (!variant) throw Object.assign(new Error(`wariant ${item.sku} nie istnieje`), { status: 404 });

        // blokada oversell - zwraca 409 gdy brak stanu
        if (variant.stock < item.quantity) {
          throw Object.assign(new Error(`brak wystarczajacej ilosci dla ${item.sku}`), { status: 409 });
        }

        await sequelize.query(
          `UPDATE "Variant" SET stock = stock - :quantity WHERE sku = :sku`,
          { replacements: { quantity: item.quantity, sku: item.sku }, transaction: t }
        );

        const linePrice = parseFloat(variant.price);
        totalAmount += linePrice * item.quantity;
        orderLinesData.push({
          sku: item.sku,
          price: linePrice, // snapshot ceny
          quantity: item.quantity
        });
      }

      // t3: hook beforeCreate sprawdza czy kwota nie jest ujemna
      const order = await Order.create({ totalAmount, status: 'paid', userId: userId || null }, { transaction: t });

      const linesWithOrderId = orderLinesData.map(line => ({ ...line, orderId: order.id }));
      await OrderLine.bulkCreate(linesWithOrderId, { transaction: t });

      return { order, lines: orderLinesData };
    });

    createdOrder = result.order;
    savedLines = result.lines;

    // krok 2: t8c hybryda - jesli podano cartId, zamknij szkic koszyka w mongodb
    if (cartId) {
      try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        await db.collection('cartdrafts').updateOne(
          { cartId: parseInt(cartId) },
          {
            $set: { status: 'closed' },
            $push: { events: { type: 'completed', sku: 'checkout', at: new Date() } }
          }
        );
      } catch (mongoError) {
        // t8c: kompensacja - jesli mongo zawiedzie, anulujemy zamowienie w pg i przywracamy stan
        console.error('blad mongo przy zamykaniu draftu, uruchamiam kompensacje...');
        await sequelize.transaction(async (t) => {
          for (const line of savedLines) {
            await sequelize.query(
              `UPDATE "Variant" SET stock = stock + :quantity WHERE sku = :sku`,
              { replacements: { quantity: line.quantity, sku: line.sku }, transaction: t }
            );
          }
          await createdOrder.update({ status: 'cancelled' }, { transaction: t });
        });
        throw Object.assign(new Error('blad archiwizacji koszyka, zamowienie wycofane'), { status: 500 });
      }
    }

    res.status(201).json({ message: 'zamowienie zlozone', order: createdOrder });
  } catch (error) {
    // t8c: jednolity format bledow
    const status = error.status || 500;
    res.status(status).json({
      error: 'blad checkoutu',
      code: status,
      details: error.message
    });
  }
});

// wymog specyficzny: historia zamowien uzytkownika
// t3: eager loading - OrderLine dolaczony do Order przez include
app.get('/orders', async (req, res) => {
  try {
    const where = {};
    if (req.query.userId) {
      where.userId = parseInt(req.query.userId);
    }

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderLine, as: 'lines' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ 
      error: 'blad pobierania historii zamowien',
      code: 500,
      details: error.message 
    });
  }
});

// wymog specyficzny: anulowanie zamowienia
// t3: transakcja zarzadzana
// regula biznesowa: anulowanie przywraca stan magazynowy (jawnie opisane)
app.post('/orders/:id/cancel', async (req, res) => {
  try {
    await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(req.params.id, {
        include: [{ model: OrderLine, as: 'lines' }],
        transaction: t
      });

      if (!order) {
        throw Object.assign(new Error('nie znaleziono zamowienia'), { status: 404 });
      }
      if (order.status === 'cancelled') {
        throw Object.assign(new Error('zamowienie jest juz anulowane'), { status: 400 });
      }

      // przywracamy stan magazynowy dla kazdej pozycji zamowienia
      for (const line of order.lines) {
        await sequelize.query(
          `UPDATE "Variant" SET stock = stock + :quantity WHERE sku = :sku`,
          { replacements: { quantity: line.quantity, sku: line.sku }, transaction: t }
        );
      }

      order.status = 'cancelled';
      await order.save({ transaction: t });
    });

    res.json({ message: 'zamowienie anulowane, stan magazynowy przywrocony' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ 
      error: 'blad anulowania zamowienia',
      code: status,
      details: error.message 
    });
  }
});

// wymog specyficzny: utworzenie koszyka w postgresql
// t3: model Cart z walidacja statusu
app.post('/api/cart', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const cart = await Cart.create({ sessionId, status: 'open' });
    res.status(201).json(cart);
  } catch (error) {
    res.status(500).json({ 
      error: 'blad tworzenia koszyka', 
      code: 500, 
      details: error.message 
    });
  }
});

// wymog specyficzny: dodawanie do koszyka z walidacja stanu magazynowego
// t3: transakcja zarzadzana, blokada FOR UPDATE
// regula biznesowa: konflikt koszyka przy wyczerpanym stanie (409)
app.post('/api/cart/:id/items', async (req, res) => {
  const { sku, quantity } = req.body;
  try {
    await sequelize.transaction(async (t) => {
      const cart = await Cart.findByPk(req.params.id, { transaction: t });

      if (!cart) {
        throw Object.assign(new Error('nie znaleziono koszyka'), { status: 404 });
      }
      if (cart.status === 'closed') {
        throw Object.assign(new Error('koszyk jest zamkniety'), { status: 400 });
      }

      const [variants] = await sequelize.query(
        `SELECT id, price, stock FROM "Variant" WHERE sku = :sku FOR UPDATE`,
        { replacements: { sku }, transaction: t }
      );

      const variant = variants[0];
      if (!variant) {
        throw Object.assign(new Error(`wariant ${sku} nie istnieje`), { status: 404 });
      }

      // regula biznesowa: blokada przy wyczerpanym stanie
      if (variant.stock < quantity) {
        throw Object.assign(
          new Error(`niewystarczajacy stan dla ${sku}: dostepne ${variant.stock}`), 
          { status: 409 }
        );
      }

      const existingLine = await CartLine.findOne({ 
        where: { cartId: cart.id, sku },
        transaction: t
      });

      if (existingLine) {
        existingLine.quantity += quantity;
        await existingLine.save({ transaction: t });
      } else {
        // snapshot ceny w momencie dodania do koszyka
        await CartLine.create({
          cartId: cart.id,
          sku,
          price: parseFloat(variant.price),
          quantity
        }, { transaction: t });
      }
    });

    const updatedCart = await Cart.findByPk(req.params.id, {
      include: [{ model: CartLine, as: 'lines' }]
    });

    res.status(201).json(updatedCart);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ 
      error: 'blad dodawania do koszyka', 
      code: status, 
      details: error.message 
    });
  }
});

// wymog specyficzny: usuwanie pozycji z koszyka
// regula biznesowa: pozycje mozna usunac z otwartego koszyka w kazdej chwili
// polityka dla otwartych koszykow: jesli produkt zniknie z menu, pozycje pozostaja
// w koszyku az do recznego usuniecia lub zamkniecia koszyka
app.delete('/api/cart/:id/items/:sku', async (req, res) => {
  try {
    const line = await CartLine.findOne({ 
      where: { cartId: req.params.id, sku: req.params.sku } 
    });

    if (!line) {
      return res.status(404).json({ 
        error: 'nie znaleziono pozycji w koszyku', 
        code: 404, 
        details: null 
      });
    }

    await line.destroy();
    res.json({ message: 'pozycja usunieta z koszyka' });
  } catch (error) {
    res.status(500).json({ 
      error: 'blad usuwania z koszyka', 
      code: 500, 
      details: error.message 
    });
  }
});

// wymog specyficzny: pobieranie koszyka z pozycjami
// t3: eager loading - CartLine dolaczony do Cart przez include
app.get('/api/cart/:id', async (req, res) => {
  try {
    const cart = await Cart.findByPk(req.params.id, {
      include: [{ model: CartLine, as: 'lines' }]
    });

    if (!cart) {
      return res.status(404).json({ 
        error: 'nie znaleziono koszyka', 
        code: 404, 
        details: null 
      });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ 
      error: 'blad pobierania koszyka', 
      code: 500, 
      details: error.message 
    });
  }
});

const PORT = process.env.CHECKOUT_PORT || 3002;
app.listen(PORT, () => {
  console.log(`checkout service dziala na porcie ${PORT}`);
});