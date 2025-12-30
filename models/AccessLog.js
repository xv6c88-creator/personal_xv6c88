const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const AccessLog = sequelize.define('AccessLog', {
    ip: DataTypes.STRING,
    country: DataTypes.STRING,
    city: DataTypes.STRING,
    path: DataTypes.STRING,
    method: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = AccessLog;
