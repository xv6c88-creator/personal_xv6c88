const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const SiteConfig = sequelize.define('SiteConfig', {
    key: {
        type: DataTypes.STRING, // e.g., 'contact_info'
        allowNull: false,
        unique: true
    },
    // Contact Info
    address_zh: DataTypes.STRING,
    address_en: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    work_hours_zh: DataTypes.STRING,
    work_hours_en: DataTypes.STRING,
    whatsapp: DataTypes.STRING,
    // About Page (bilingual)
    about_lead_zh: DataTypes.TEXT,
    about_lead_en: DataTypes.TEXT,
    about_desc_zh: DataTypes.TEXT,
    about_desc_en: DataTypes.TEXT,
    about_mission_zh: DataTypes.STRING,
    about_mission_en: DataTypes.STRING,
    about_stats_exp_zh: DataTypes.STRING,
    about_stats_exp_en: DataTypes.STRING,
    about_stats_export_zh: DataTypes.STRING,
    about_stats_export_en: DataTypes.STRING,
    about_stats_team_zh: DataTypes.STRING,
    about_stats_team_en: DataTypes.STRING,
    // Services & Support Page (bilingual)
    services_title_zh: DataTypes.STRING,
    services_title_en: DataTypes.STRING,
    services_content_zh: DataTypes.TEXT,
    services_content_en: DataTypes.TEXT
});

module.exports = SiteConfig;
