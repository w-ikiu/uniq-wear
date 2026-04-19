'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderLine extends Model {
    static associate(models) {
      // wymog t3: relacje (odwrotna strona)
      OrderLine.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    }
  }
  
  OrderLine.init({
    orderId: DataTypes.INTEGER,
    sku: DataTypes.STRING,
    price: {
      type: DataTypes.DECIMAL,
      // wymog t3: kolejna walidacja
      validate: {
        min: 0.01
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1
      }
    }
  }, {
    sequelize,
    modelName: 'OrderLine',
  });
  return OrderLine;
};