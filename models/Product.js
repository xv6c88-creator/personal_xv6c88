const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Product = sequelize.define('Product', {
    // Chinese Fields
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    features: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    
    // English Fields
    name_en: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category_en: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description_en: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    features_en: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    // Media
    image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    video: {
        type: DataTypes.STRING, // Path to video file
        allowNull: true
    },
    video_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    manual: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = Product;
