const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const AdminUser = sequelize.define('AdminUser', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

module.exports = AdminUser;
