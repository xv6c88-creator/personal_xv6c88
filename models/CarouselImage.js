const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const CarouselImage = sequelize.define('CarouselImage', {
    image: {
        type: DataTypes.STRING,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    caption: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = CarouselImage;
