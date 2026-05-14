'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CartLine extends Model {
    static associate(models) {
      // kazda pozycja nalezy do jednego koszyka
      CartLine.belongsTo(models.Cart, { foreignKey: 'cartId', as: 'cart' });
    }
  }

  CartLine.init({
    cartId: {
      type: DataTypes.INTEGER
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL,
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
    modelName: 'CartLine'
  });

  return CartLine;
};