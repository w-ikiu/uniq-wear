'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Cart extends Model {
    static associate(models) {
      // jeden koszyk ma wiele pozycji
      Cart.hasMany(models.CartLine, { foreignKey: 'cartId', as: 'lines' });
    }
  }

  Cart.init({
    status: {
      type: DataTypes.STRING,
      defaultValue: 'open',
      validate: {
        isIn: [['open', 'closed']]
      }
    },
    sessionId: {
      type: DataTypes.STRING
    }
  }, {
    sequelize,
    modelName: 'Cart'
  });

  return Cart;
};