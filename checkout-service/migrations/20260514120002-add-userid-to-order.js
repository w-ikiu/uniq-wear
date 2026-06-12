'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // uuid keycloaka to string — nie integer
    await queryInterface.addColumn('Orders', 'userId', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Orders', 'userId');
  }
};
