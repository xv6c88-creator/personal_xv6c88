const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const SupportResource = sequelize.define('SupportResource', {
    title_zh: DataTypes.STRING,
    title_en: DataTypes.STRING,
    description_zh: DataTypes.TEXT,
    description_en: DataTypes.TEXT,
    type: { // 'manual' | 'video'
        type: DataTypes.STRING,
        allowNull: false
    },
    file_path: DataTypes.STRING, // for manuals (pdf)
    video_path: DataTypes.STRING  // for videos
});

module.exports = SupportResource;

