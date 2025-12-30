const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ChatSession = sequelize.define('ChatSession', {
    company: DataTypes.STRING,
    interested_product: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    status: {
        type: DataTypes.STRING,
        defaultValue: 'open'
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = ChatSession;

