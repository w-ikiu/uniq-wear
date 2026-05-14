require('dotenv').config();
const express = require('express');
const { sequelize, Order, OrderLine } = require('./models');
const connectMongo = require('./config/mongo');

const app = express();
app.use(express.json());

// polaczenie z mongodb
connectMongo();

// endpoint obslugujacy koszyk i skladanie zamowienia
app.post('/checkout', async (req, res) => {
  const { items } = req.body; 
  // oczekujemy formatu: [{ sku: 'AM1-BLU-42', quantity: 1 }]

  try {
    // wymog t3: transakcja zarzadzana (managed transaction)
    const result = await sequelize.transaction(async (t) => {
      let totalAmount = 0;
      const orderLinesData = [];

      for (const item of items) {
        // 1. sprawdzamy stan w tabeli wariantow (zarzadzanej przez catalog-service)
        // klauzula 'for update' blokuje ten wiersz w bazie, dopki nie skonczymy! zapobiega to wyscigom.
        const [variants] = await sequelize.query(
          `SELECT id, price, stock FROM "Variant" WHERE sku = :sku FOR UPDATE`,
          { replacements: { sku: item.sku }, transaction: t }
        );

        const variant = variants[0];
        if (!variant) throw Object.assign(new Error(`wariant ${item.sku} nie istnieje`), { status: 404 });
        
        // blokada oversell (wymog: kod 409)
        if (variant.stock < item.quantity) {
          throw Object.assign(new Error(`brak wystarczajacej ilosci dla ${item.sku}`), { status: 409 });
        }

        // 2. aktualizacja stanu magazynowego (odjecie kupionej ilosci)
        await sequelize.query(
          `UPDATE "Variant" SET stock = stock - :quantity WHERE sku = :sku`,
          { replacements: { quantity: item.quantity, sku: item.sku }, transaction: t }
        );

        // 3. logowanie ceny jako snapshot w orderline
        const linePrice = parseFloat(variant.price);
        totalAmount += linePrice * item.quantity;
        orderLinesData.push({
          sku: item.sku,
          price: linePrice,
          quantity: item.quantity
        });
      }

      // 4. utworzenie zamowienia (wywola tez hook z walidacja z wymogu t3)
      const order = await Order.create({ totalAmount, status: 'paid' }, { transaction: t });

      // 5. doczepienie id zamowienia do pozycji i masowy zapis (order_lines ze snapshotem)
      const linesWithOrderId = orderLinesData.map(line => ({ ...line, orderId: order.id }));
      await OrderLine.bulkCreate(linesWithOrderId, { transaction: t });

      return order;
    });

    res.status(201).json({ message: 'zamowienie zlozone', order: result });
  } catch (error) {
    // jednolity format bledow (wymog t8c)
    const status = error.status || 500;
    res.status(status).json({ 
      error: 'blad checkoutu', 
      code: status, 
      details: error.message 
    });
  }
});

// endpoint do pobierania historii zamowien (wymog specyficzny)
// oraz eager loading z uzyciem include (wymog t3 - sequelize)
app.get('/orders', async (req, res) => {
  try {
    // pobieramy wszystkie zamowienia
    const orders = await Order.findAll({
      // eager loading: od razu doczepiamy pozycje z koszyka do zamowienia
      include: [
        {
          model: OrderLine
        }
      ],
      order: [['createdAt', 'DESC']] // sortujemy od najnowszych
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

// endpoint: order history (business requirement) & eager loading (t3)
app.get('/orders/history', async (req, res) => {
  try {
    const orders = await Order.findAll({
      // include order lines automatically - this is eager loading for t3
      include: [{ model: OrderLine }],
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ 
      error: 'order history error',
      code: 500,
      details: error.message 
    });
  }
});

// endpoint: cancel order and restore stock (business requirement)
app.post('/orders/:id/cancel', async (req, res) => {
  try {
    // managed transaction for safety
    await sequelize.transaction(async (t) => {
      // fetch order with items
      const order = await Order.findByPk(req.params.id, {
        include: [{ model: OrderLine }],
        transaction: t
      });

      if (!order) {
        throw Object.assign(new Error('order not found'), { status: 404 });
      }
      if (order.status === 'cancelled') {
        throw Object.assign(new Error('order already cancelled'), { status: 400 });
      }

      // loop through order lines and restore stock in catalog
      for (const line of order.OrderLines) {
        await sequelize.query(
          `UPDATE "Variant" SET stock = stock + :quantity WHERE sku = :sku`,
          { replacements: { quantity: line.quantity, sku: line.sku }, transaction: t }
        );
      }

      // update order status
      order.status = 'cancelled';
      await order.save({ transaction: t });
    });

    res.json({ message: 'order cancelled and stock successfully restored' });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ 
      error: 'cancel failed',
      code: status,
      details: error.message 
    });
  }
});

const PORT = process.env.CHECKOUT_PORT || 3002;
app.listen(PORT, () => {
  console.log(`checkout service dziala na porcie ${PORT}`);
});