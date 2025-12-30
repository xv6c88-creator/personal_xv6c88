const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ProductImage = sequelize.define('ProductImage', {
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false
    },
    is_main: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = ProductImage;
