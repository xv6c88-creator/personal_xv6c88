const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const ChatMessage = sequelize.define('ChatMessage', {
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sender: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = ChatMessage;

