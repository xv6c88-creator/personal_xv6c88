const express = require('express');
const path = require('path');
const session = require('express-session');
const sequelize = require('./database');
const Product = require('./models/Product');
const SiteConfig = require('./models/SiteConfig');
const Category = require('./models/Category');
const AccessLog = require('./models/AccessLog');
const ProductImage = require('./models/ProductImage');
const ChatSession = require('./models/ChatSession');
const ChatMessage = require('./models/ChatMessage');
const locales = require('./config/locales');
const geoip = require('geoip-lite');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Access Logging Middleware
app.use(async (req, res, next) => {
    if (!req.path.startsWith('/css') && !req.path.startsWith('/images') && !req.path.startsWith('/videos') && !req.path.startsWith('/admin')) {
        try {
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            // Clean up IP if it's ::ffff: format
            const cleanIp = ip.replace('::ffff:', '');
            
            const geo = geoip.lookup(cleanIp);
            const country = geo ? geo.country : '';
            const city = geo ? geo.city : '';

            await AccessLog.create({
                ip: cleanIp,
                country: country,
                city: city,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent')
            });
        } catch (err) {
            console.error('Logging failed:', err);
        }
    }
    next();
});

// Session setup for Admin and Language
app.use(session({
    secret: 'ouma_machinery_secret_key',
    resave: false,
    saveUninitialized: false,
}));

// Global Variables & i18n Middleware
app.use(async (req, res, next) => {
    // Language Logic: Query Param > Session > GeoIP-based default
    if (req.query.lang) {
        req.session.lang = req.query.lang;
    }
    const supportedLangs = Object.keys(locales);
    let lang = req.session.lang;
    if (!lang) {
        try {
            const ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
            const ip = (ipRaw || '').replace('::ffff:', '');
            const geo = geoip.lookup(ip);
            const country = geo ? geo.country : '';
            const zhCountries = ['CN', 'TW', 'HK', 'MO'];
            lang = zhCountries.includes(country) ? 'zh' : 'en';
            req.session.lang = lang;
        } catch (e) {
            lang = 'zh';
        }
    }
    if (!supportedLangs.includes(lang)) {
        lang = 'en';
        req.session.lang = 'en';
    }
    
    res.locals.isAuthenticated = req.session.isAuthenticated || false;
    res.locals.lang = lang;
    res.locals.t = locales[lang] || locales.en;
    
    // Inject Site Config
    try {
        let config = await SiteConfig.findOne({ where: { key: 'contact_info' } });
        if (!config) {
            // Fallback to defaults from locales if DB is empty
            config = {
                address_zh: locales.zh.contactContent.address,
                address_en: "88 Industry Park, Some City, China", // Default fallback
                phone: "400-123-4567",
                email: "info@oumamachinery.com",
                work_hours_zh: locales.zh.contactContent.workHours,
                work_hours_en: "Mon-Fri: 9:00 - 18:00",
                whatsapp: "+8613800000000"
            };
        }
        if (config && !config.whatsapp) {
            config.whatsapp = "+8613800000000";
        }
        res.locals.siteConfig = config;
    } catch (err) {
        console.error("Failed to load site config:", err);
        res.locals.siteConfig = {};
    }
    // Inject About Config
    try {
        let about = await SiteConfig.findOne({ where: { key: 'about_info' } });
        if (!about) {
            about = {
                about_lead_zh: locales.zh.aboutContent.lead,
                about_lead_en: locales.en.aboutContent.lead,
                about_desc_zh: locales.zh.aboutContent.desc,
                about_desc_en: locales.en.aboutContent.desc,
                about_mission_zh: locales.zh.aboutContent.mission,
                about_mission_en: locales.en.aboutContent.mission,
                about_stats_exp_zh: locales.zh.aboutContent.stats.exp,
                about_stats_exp_en: locales.en.aboutContent.stats.exp,
                about_stats_export_zh: locales.zh.aboutContent.stats.export,
                about_stats_export_en: locales.en.aboutContent.stats.export,
                about_stats_team_zh: locales.zh.aboutContent.stats.team,
                about_stats_team_en: locales.en.aboutContent.stats.team
            };
        }
        res.locals.aboutConfig = about;
    } catch (err) {
        console.error("Failed to load about info:", err);
        res.locals.aboutConfig = {};
    }
    // Inject Services Config
    try {
        let services = await SiteConfig.findOne({ where: { key: 'services_info' } });
        if (!services) {
            services = {
                services_title_zh: "服务与支持",
                services_title_en: "Services & Support",
                services_content_zh: "如需服务与支持，请通过电话或邮箱联系我们。",
                services_content_en: "For service and support, please contact us via phone or email."
            };
        }
        res.locals.servicesConfig = services;
    } catch (err) {
        console.error("Failed to load services info:", err);
        res.locals.servicesConfig = {};
    }

    // Helper to get bilingual content
    res.locals.l = (obj, field) => {
        if (lang === 'en' && obj[field + '_en']) {
            return obj[field + '_en'];
        }
        return obj[field];
    };
    res.locals.stripHtml = (s) => {
        try {
            return (s || '').replace(/<[^>]*>/g, '');
        } catch (e) {
            return s || '';
        }
    };
    res.locals.truncate = (s, n) => {
        const str = s || '';
        if (!n || str.length <= n) return str;
        return str.substring(0, n) + '...';
    };

    next();
});

// Routes
const mainRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/', mainRoutes);
app.use('/admin', adminRoutes);

// Database Sync and Server Start
// Using { alter: true } to update table schema without deleting data
sequelize.sync({ alter: true }) 
    .then(async () => {
        console.log('Database synced');
        
        // Seed SiteConfig if empty
        const configCount = await SiteConfig.count();
        if (configCount === 0) {
            await SiteConfig.create({
                key: 'contact_info',
                address_zh: locales.zh.contactContent.address,
                address_en: "88 Industry Park, Some City, China",
                phone: "400-123-4567",
                email: "info@oumamachinery.com",
                work_hours_zh: locales.zh.contactContent.workHours,
                work_hours_en: "Mon-Fri: 9:00 - 18:00"
            });
            console.log("Site Config seeded");
        }

        // Seed Categories if empty
        const catCount = await Category.count();
        if (catCount === 0) {
            await Category.bulkCreate([
                { name: "车床系列", name_en: "Lathes" },
                { name: "冲压设备", name_en: "Presses" },
                { name: "自动化设备", name_en: "Automation" }
            ]);
            console.log("Categories seeded");
        }

        // Seed initial data if empty
        const count = await Product.count();
        if (count === 0) {
            await Product.bulkCreate([
                {
                    name: "CNC精密车床 X-200",
                    name_en: "CNC Precision Lathe X-200",
                    category: "车床系列",
                    category_en: "Lathes",
                    description: "高精度CNC车床，适用于重型工业应用，性能稳定可靠。",
                    description_en: "High precision CNC lathe suitable for heavy duty industrial applications.",
                    features: "高速主轴\n自动换刀系统\n占地面积小",
                    features_en: "High Speed Spindle\nAutomated Tool Changer\nCompact Footprint",
                    image: ""
                },
                {
                    name: "液压机 H-500",
                    name_en: "Hydraulic Press H-500",
                    category: "冲压设备",
                    category_en: "Presses",
                    description: "500吨级液压机，专为金属成型设计，压力控制精确。",
                    description_en: "500-ton hydraulic press for metal forming.",
                    features: "压力精确控制\n安全防护装置\n数字显示屏",
                    features_en: "Pressure Control\nSafety Guards\nDigital Display",
                    image: ""
                },
                {
                    name: "工业机械臂 R-10",
                    name_en: "Industrial Robotic Arm R-10",
                    category: "自动化设备",
                    category_en: "Automation",
                    description: "6轴工业机械臂，适用于组装、焊接等自动化场景。",
                    description_en: "6-axis robotic arm for assembly and welding.",
                    features: "高负载能力\n高精度定位\n编程简单",
                    features_en: "High Payload\nPrecision Accuracy\nEasy Programming",
                    image: ""
                }
            ]);
            console.log("Initial data seeded");
        }

        // Seed AdminUser if empty
        const AdminUser = require('./models/AdminUser');
        const bcrypt = require('bcryptjs');
        const adminCount = await AdminUser.count();
        if (adminCount === 0) {
            await AdminUser.create({
                username: 'admin',
                passwordHash: await bcrypt.hash('admin123', 10)
            });
            console.log("Admin user seeded");
        }

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => console.error('Database connection error:', err));
