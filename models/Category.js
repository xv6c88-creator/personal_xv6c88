const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Category = sequelize.define('Category', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name_en: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

module.exports = Category;
