'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      // wymog t3: relacje
      Order.hasMany(models.OrderLine, { foreignKey: 'orderId', as: 'lines' });
    }
  }
  
  Order.init({
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
      // wymog t3: walidacja
      validate: {
        isIn: [['pending', 'paid', 'cancelled']]
      }
    },
    totalAmount: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'Order',
    hooks: {
      // wymog t3: hook domenowy - przed zapisem sprawdzamy czy kwota nie jest ujemna
      beforeCreate: (order) => {
        if (order.totalAmount < 0) {
          throw new Error('kwota zamowienia nie moze byc ujemna');
        }
      }
    }
  });
  return Order;
};