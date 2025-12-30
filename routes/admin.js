const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const SiteConfig = require('../models/SiteConfig');
const Category = require('../models/Category');
const AccessLog = require('../models/AccessLog');
const os = require('os');
const translate = require('@vitalets/google-translate-api');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const CarouselImage = require('../models/CarouselImage');
const ProductImage = require('../models/ProductImage');
let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = null; }
const SupportResource = require('../models/SupportResource');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const sequelize = require('../database');
const fs = require('fs');

// Safe translate helper
async function safeTranslate(text) {
    try {
        if (!text) return '';
        const r = await translate(text, { to: 'en' });
        return r.text || text;
    } catch (e) {
        return text;
    }
}

// Multer config for image and video upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const fs = require('fs');
        const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
        if (file.mimetype.startsWith('video/')) {
            ensureDir('public/videos/');
            cb(null, 'public/videos/');
        } else if (file.mimetype === 'application/pdf') {
            ensureDir('public/docs/');
            cb(null, 'public/docs/');
        } else {
            ensureDir('public/images/');
            cb(null, 'public/images/');
        }
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });
// Helper to get files by field name across different multer modes
function getFiles(req, name) {
    if (!req.files) return [];
    if (Array.isArray(req.files)) {
        return req.files.filter(f => f.fieldname === name);
    }
    return req.files[name] || [];
}

// Admin root redirect
router.get('/', (req, res) => {
    if (req.session.isAuthenticated) {
        res.redirect('/admin/products?upload_success=1');
    } else {
        res.redirect('/admin/login');
    }
});

// Ensure HTML content type for admin pages
router.use((req, res, next) => {
    res.type('html');
    next();
});

// Auth Middleware
const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Login Routes
router.get('/login', (req, res) => {
    res.render('admin/login', { title: '管理员登录', error: null });
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await AdminUser.findOne({ where: { username } });
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            req.session.isAuthenticated = true;
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/login', { title: '管理员登录', error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.render('admin/login', { title: '管理员登录', error: 'Server error' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const products = await Product.findAll();
        
        // Visitor Map Data
        const countryStats = await AccessLog.findAll({
            attributes: ['country', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['country'],
            raw: true
        });
        const visitorMap = {};
        countryStats.forEach(stat => {
            if (stat.country) visitorMap[stat.country] = stat.count;
        });
        
        // Server Stats
        const serverStats = {
            uptime: Math.floor(os.uptime() / 60) + " min",
            freemem: (os.freemem() / 1024 / 1024).toFixed(2) + " MB",
            totalmem: (os.totalmem() / 1024 / 1024).toFixed(2) + " MB",
            platform: os.platform(),
            nodeVersion: process.version
        };

        // Database Status
        const dbStats = {
            status: 'offline',
            message: '',
            dialect: '',
            storage: '',
            size: '',
            tables: 0,
            lastUpdated: ''
        };
        try {
            await sequelize.authenticate();
            dbStats.status = 'online';
        } catch (e) {
            dbStats.status = 'error';
            dbStats.message = e.message || 'Unknown error';
        }
        try {
            dbStats.dialect = sequelize.getDialect();
            if (dbStats.dialect === 'sqlite') {
                const storage = sequelize.options.storage;
                dbStats.storage = storage;
                try {
                    const stat = fs.statSync(storage);
                    dbStats.size = (stat.size / 1024 / 1024).toFixed(2) + ' MB';
                    dbStats.lastUpdated = new Date(stat.mtime).toLocaleString();
                } catch (e) {
                    dbStats.size = '-';
                    dbStats.lastUpdated = '-';
                }
            }
            const qi = sequelize.getQueryInterface();
            const tables = await qi.showAllTables();
            dbStats.tables = Array.isArray(tables) ? tables.length : 0;
        } catch (e) {}

        // Recent Access Logs (Limit 20)
        const accessLogs = await AccessLog.findAll({
            limit: 20,
            order: [['timestamp', 'DESC']]
        });

        res.render('admin/dashboard', { 
            title: '后台管理', 
            products: products,
            serverStats: serverStats,
            dbStats: dbStats,
            accessLogs: accessLogs,
            visitorMap: visitorMap,
            query: req.query || {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Products List Page
router.get('/products', requireAuth, async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['id', 'DESC']] });
        res.render('admin/products', { title: '产品列表', products, query: req.query });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading products');
    }
});

// === Contact Info Management ===
router.get('/contact', requireAuth, async (req, res) => {
    try {
        const config = await SiteConfig.findOne({ where: { key: 'contact_info' } });
        res.render('admin/contact_form', { title: '联系方式管理', config: config || {} });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading contact info');
    }
});

router.post('/contact', requireAuth, async (req, res) => {
    try {
        const { address_zh, address_en, phone, email, work_hours_zh, work_hours_en, whatsapp } = req.body;
        
        let config = await SiteConfig.findOne({ where: { key: 'contact_info' } });
        if (config) {
            await config.update({ address_zh, address_en, phone, email, work_hours_zh, work_hours_en, whatsapp });
        } else {
            await SiteConfig.create({
                key: 'contact_info',
                address_zh, address_en, phone, email, work_hours_zh, work_hours_en, whatsapp
            });
        }
        res.redirect('/admin/contact');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating contact info');
    }
});

// === About Page Management ===
router.get('/about', requireAuth, async (req, res) => {
    try {
        const config = await SiteConfig.findOne({ where: { key: 'about_info' } });
        res.render('admin/about_form', { title: '关于我们管理', config: config || {} });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading about info');
    }
});

// === Services & Support Management ===
router.get('/services', requireAuth, async (req, res) => {
    try {
        const config = await SiteConfig.findOne({ where: { key: 'services_info' } });
        res.render('admin/services_form', { title: '服务与支持管理', config: config || {} });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading services info');
    }
});

// === Support Resources (Manuals & Videos) ===
router.get('/support', requireAuth, async (req, res) => {
    try {
        const resources = await SupportResource.findAll({ order: [['id', 'DESC']] });
        res.render('admin/support', { title: '服务与技术资源', resources });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading resources');
    }
});

router.post('/support/add', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const { type, title_zh, title_en, description_zh, description_en } = req.body;
        let file_path = '';
        let video_path = '';
        if (req.file) {
            if (req.file.mimetype.startsWith('video/')) {
                video_path = '/videos/' + req.file.filename;
            } else if (req.file.mimetype === 'application/pdf') {
                file_path = '/docs/' + req.file.filename;
            }
        }
        await SupportResource.create({ type, title_zh, title_en, description_zh, description_en, file_path, video_path });
        res.redirect('/admin/support');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding resource');
    }
});

router.get('/support/delete/:id', requireAuth, async (req, res) => {
    try {
        await SupportResource.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/support');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting resource');
    }
});
router.post('/services', requireAuth, async (req, res) => {
    try {
        const { services_title_zh, services_title_en, services_content_zh, services_content_en } = req.body;
        let config = await SiteConfig.findOne({ where: { key: 'services_info' } });
        if (config) {
            await config.update({ services_title_zh, services_title_en, services_content_zh, services_content_en });
        } else {
            await SiteConfig.create({ key: 'services_info', services_title_zh, services_title_en, services_content_zh, services_content_en });
        }
        res.redirect('/admin/services');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating services info');
    }
});
router.post('/about', requireAuth, async (req, res) => {
    try {
        const {
            about_lead_zh, about_lead_en,
            about_desc_zh, about_desc_en,
            about_mission_zh, about_mission_en,
            about_stats_exp_zh, about_stats_exp_en,
            about_stats_export_zh, about_stats_export_en,
            about_stats_team_zh, about_stats_team_en
        } = req.body;
        let config = await SiteConfig.findOne({ where: { key: 'about_info' } });
        if (config) {
            await config.update({
                about_lead_zh, about_lead_en,
                about_desc_zh, about_desc_en,
                about_mission_zh, about_mission_en,
                about_stats_exp_zh, about_stats_exp_en,
                about_stats_export_zh, about_stats_export_en,
                about_stats_team_zh, about_stats_team_en
            });
        } else {
            await SiteConfig.create({
                key: 'about_info',
                about_lead_zh, about_lead_en,
                about_desc_zh, about_desc_en,
                about_mission_zh, about_mission_en,
                about_stats_exp_zh, about_stats_exp_en,
                about_stats_export_zh, about_stats_export_en,
                about_stats_team_zh, about_stats_team_en
            });
        }
        res.redirect('/admin/about');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating about info');
    }
});
// === Category Management ===
router.get('/categories', requireAuth, async (req, res) => {
    try {
        const categories = await Category.findAll();
        const products = await Product.findAll({ order: [['id', 'DESC']] });
        res.render('admin/categories', { title: '产品分类管理', categories: categories, products });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading categories');
    }
});

router.post('/categories/add', requireAuth, async (req, res) => {
    try {
        const { name, name_en } = req.body;
        await Category.create({ name, name_en });
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding category');
    }
});

router.get('/categories/delete/:id', requireAuth, async (req, res) => {
    try {
        await Category.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories');
    }
});
router.post('/categories/update/:id', requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { name, name_en } = req.body;
        const cat = await Category.findByPk(id);
        if (cat) {
            await cat.update({ name, name_en });
        }
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/categories');
    }
});

// Add Product
router.get('/product/add', requireAuth, async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.render('admin/product_form', { title: '添加产品', product: null, categories: categories, mainImages: [], galleryImages: [] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading form');
    }
});

router.post('/product/add', requireAuth, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'gallery', maxCount: 100 },
    { name: 'features_photos', maxCount: 100 }
]), async (req, res) => {
    try {
        const { 
            name, category, description, features,
            name_en, category_en, description_en, features_en 
        } = req.body;
        const imageFiles = getFiles(req, 'image');
        const videoFiles = getFiles(req, 'video');
        const galleryFiles = getFiles(req, 'gallery');
        const featuresPhotoFiles = getFiles(req, 'features_photos');

        const image = imageFiles[0] ? '/images/' + imageFiles[0].filename : '';
        const video = videoFiles[0] ? '/videos/' + videoFiles[0].filename : '';
        const video_url = req.body.video_url || '';

        let final_name_en = name_en;
        let final_desc_en = description_en;
        let final_features_en = features_en;
        let final_category_en = category_en;

        if (!final_name_en && name) {
            final_name_en = await safeTranslate(name);
        }
        if (!final_desc_en && description) {
            final_desc_en = await safeTranslate(description);
        }
        if (!final_features_en && features) {
            final_features_en = await safeTranslate(features);
        }
        if (!final_category_en) {
            const cat = await Category.findOne({ where: { name: category } });
            final_category_en = cat ? cat.name_en : (category ? await safeTranslate(category) : '');
        }

        let final_features = features || '';
        if (featuresPhotoFiles && featuresPhotoFiles.length > 0) {
            for (const file of featuresPhotoFiles) {
                final_features += `<p><img src="/images/${file.filename}" class="img-fluid"></p>`;
            }
        }

        const created = await Product.create({
            name, category, description, features: final_features,
            name_en: final_name_en, category_en: final_category_en, description_en: final_desc_en, features_en: final_features_en,
            image, video, video_url
        });
        // Save main image record (single)
        if (imageFiles && imageFiles.length > 0) {
            const file = imageFiles[0];
            await ProductImage.create({
                productId: created.id,
                image: '/images/' + file.filename,
                is_main: true
            });
        }
        // Save gallery images if any
        if (galleryFiles && galleryFiles.length > 0) {
            for (const file of galleryFiles) {
                await ProductImage.create({
                    productId: created.id,
                    image: '/images/' + file.filename,
                    is_main: false
                });
            }
        }
        res.redirect('/admin/products?upload_success=1');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding product');
    }
});

// Edit Product
router.get('/product/edit/:id', requireAuth, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        const mainImages = await ProductImage.findAll({ where: { productId: product.id, is_main: true } });
        const galleryImages = await ProductImage.findAll({ where: { productId: product.id, is_main: false } });
        const categories = await Category.findAll();
        res.render('admin/product_form', { title: '编辑产品', product: product, categories: categories, mainImages, galleryImages });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.post('/product/edit/:id', requireAuth, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'gallery', maxCount: 100 },
    { name: 'features_photos', maxCount: 100 }
]), async (req, res) => {
    try {
        const { 
            name, category, description, features,
            name_en, category_en, description_en, features_en 
        } = req.body;
        const product = await Product.findByPk(req.params.id);
        const imageFiles = getFiles(req, 'image');
        const videoFiles = getFiles(req, 'video');
        const galleryFiles = getFiles(req, 'gallery');
        const featuresPhotoFiles = getFiles(req, 'features_photos');
        
        if (product) {
            product.name = name;
            product.category = category;
            product.description = description;
            product.features = features;
            
            product.name_en = name_en || (name ? await safeTranslate(name) : product.name_en);
            if (category_en) {
                product.category_en = category_en;
            } else {
                const cat = await Category.findOne({ where: { name: category } });
                product.category_en = cat ? cat.name_en : (category ? await safeTranslate(category) : product.category_en);
            }
            product.description_en = description_en || (description ? await safeTranslate(description) : product.description_en);
            product.features_en = features_en || (features ? await safeTranslate(features) : product.features_en);

            if (imageFiles[0]) {
                product.image = '/images/' + imageFiles[0].filename;
            }
            // Add/replace main image record (single)
            if (imageFiles && imageFiles.length > 0) {
                const file = imageFiles[0];
                await ProductImage.create({
                    productId: product.id,
                    image: '/images/' + file.filename,
                    is_main: true
                });
            }
            if (videoFiles[0]) {
                product.video = '/videos/' + videoFiles[0].filename;
            }
            if (typeof req.body.video_url !== 'undefined') {
                product.video_url = req.body.video_url || null;
            }
            // Add new gallery images
            if (galleryFiles && galleryFiles.length > 0) {
                for (const file of galleryFiles) {
                    await ProductImage.create({
                        productId: product.id,
                        image: '/images/' + file.filename,
                        is_main: false
                    });
                }
            }
            if (featuresPhotoFiles && featuresPhotoFiles.length > 0) {
                for (const file of featuresPhotoFiles) {
                    product.features = (product.features || '') + `<p><img src="/images/${file.filename}" class="img-fluid"></p>`;
                }
            }
            await product.save();
            // Ensure only one main image record remains
            try {
                const mains = await ProductImage.findAll({ 
                    where: { productId: product.id, is_main: true }, 
                    order: [['id', 'DESC']] 
                });
                if (mains && mains.length > 0) {
                    const keep = mains.find(mi => mi.image === product.image) || mains[0];
                    for (const mi of mains) {
                        if (mi.id !== keep.id) {
                            await mi.destroy();
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to cleanup main images for product', product.id, e);
            }
        }
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating product');
    }
});

// === Admin Account Management ===
router.get('/account', requireAuth, async (req, res) => {
    try {
        const user = await AdminUser.findOne({ where: { username: 'admin' } });
        res.render('admin/account', { title: '账户设置', user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading account');
    }
});

router.post('/account', requireAuth, async (req, res) => {
    try {
        const { username, password } = req.body;
        let user = await AdminUser.findOne({ where: { username: 'admin' } });
        const hash = password ? await bcrypt.hash(password, 10) : null;
        if (user) {
            await user.update({ username: username || user.username, passwordHash: hash || user.passwordHash });
        } else {
            await AdminUser.create({ username, passwordHash: hash });
        }
        res.redirect('/admin/account');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating account');
    }
});

// === System Plugins Update ===
const { exec } = require('child_process');
router.post('/system/update-plugins', requireAuth, async (req, res) => {
    exec('npm.cmd update', { cwd: process.cwd() }, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
            console.error(stderr);
        }
        res.redirect('/admin/dashboard?plugins_updated=1');
    });
});

// === Plugins Management Page ===
router.get('/plugins', requireAuth, async (req, res) => {
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = pkg.dependencies || {};
        const devDeps = pkg.devDependencies || {};
        exec('npm.cmd outdated --json', { cwd: process.cwd() }, (error, stdoutOutdated, stderrOutdated) => {
            let outdated = {};
            try {
                outdated = stdoutOutdated ? JSON.parse(stdoutOutdated) : {};
            } catch (e) {
                outdated = {};
            }
            exec('npm.cmd audit --json', { cwd: process.cwd() }, (auditErr, stdoutAudit, stderrAudit) => {
                let audit = { vulnerabilities: {}, total: 0, advisories: [] };
                try {
                    const auditJson = stdoutAudit ? JSON.parse(stdoutAudit) : {};
                    const meta = auditJson.metadata || {};
                    audit.vulnerabilities = meta.vulnerabilities || {};
                    audit.total = Object.values(audit.vulnerabilities).reduce((sum, n) => sum + (n || 0), 0);
                } catch (e) {
                    audit = { vulnerabilities: {}, total: 0, advisories: [] };
                }
                res.render('admin/plugins', {
                    title: '系统插件管理',
                    deps,
                    devDeps,
                    outdated,
                    audit,
                    updated: req.query.updated || '',
                    updatedPkg: req.query.pkg || '',
                    auditFixed: req.query.audit_fixed || ''
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading plugins');
    }
});

router.post('/plugins/update-all', requireAuth, async (req, res) => {
    exec('npm.cmd update', { cwd: process.cwd() }, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
            console.error(stderr);
        }
        res.redirect('/admin/plugins?updated=all');
    });
});

router.post('/plugins/update/:name', requireAuth, async (req, res) => {
    const name = req.params.name;
    if (!name) return res.redirect('/admin/plugins');
    exec(`npm.cmd install ${name}@latest`, { cwd: process.cwd() }, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
            console.error(stderr);
        }
        res.redirect('/admin/plugins?updated=one&pkg=' + encodeURIComponent(name));
    });
});

router.post('/plugins/audit-fix', requireAuth, async (req, res) => {
    exec('npm.cmd audit fix', { cwd: process.cwd() }, (error, stdout, stderr) => {
        console.log(stdout);
        if (error) {
            console.error(stderr);
        }
        res.redirect('/admin/plugins?audit_fixed=1');
    });
});

// Delete Product
router.get('/product/delete/:id', requireAuth, async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (product) {
            await product.destroy();
        }
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

// Delete a gallery image
router.get('/product/image/delete/:id', requireAuth, async (req, res) => {
    try {
        await ProductImage.destroy({ where: { id: req.params.id } });
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.redirect('back');
    }
});
// === Carousel Management ===
router.get('/carousel', requireAuth, async (req, res) => {
    try {
        const items = await CarouselImage.findAll({ order: [['id', 'DESC']] });
        res.render('admin/carousel', { title: '首页轮播管理', items });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading carousel');
    }
});

router.get('/carousel/edit/:id', requireAuth, async (req, res) => {
    try {
        const item = await CarouselImage.findByPk(req.params.id);
        if (!item) return res.redirect('/admin/carousel');
        res.render('admin/carousel_edit', { title: '编辑轮播图片', item });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading item');
    }
});

router.post('/carousel/resize/:id', requireAuth, async (req, res) => {
    try {
        const { title, caption, target_width, target_height, scale_percent } = req.body;
        const item = await CarouselImage.findByPk(req.params.id);
        if (!item) return res.redirect('/admin/carousel');
        // Update meta
        await item.update({ title, caption });
        // Resize if requested
        let w = parseInt(target_width) || null;
        let h = parseInt(target_height) || null;
        const sp = parseInt(scale_percent) || null;
        if (sharp && item.image) {
            const filename = item.image.replace('/images/', '');
            const fullPath = path.join('public', 'images', filename);
            try {
                if (sp && sp > 0) {
                    const meta = await sharp(fullPath).metadata();
                    w = Math.max(1, Math.round((meta.width || 0) * sp / 100));
                    h = Math.max(1, Math.round((meta.height || 0) * sp / 100));
                }
                if (w || h) {
                    await sharp(fullPath).resize({
                        width: w || undefined,
                        height: h || undefined,
                        fit: 'cover',
                        position: 'center'
                    }).toFile(fullPath + '.tmp');
                }
                const fs = require('fs');
                if (await fs.promises.stat(fullPath + '.tmp').catch(() => null)) {
                    await fs.promises.rename(fullPath + '.tmp', fullPath);
                }
            } catch (e) {
                console.error('Resize failed for', fullPath, e);
            }
        }
        res.redirect('/admin/carousel');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error resizing item');
    }
});

router.post('/carousel/add', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const { title, caption, target_width, target_height, scale_percent } = req.body;
        let w = parseInt(target_width) || null;
        let h = parseInt(target_height) || null;
        const sp = parseInt(scale_percent) || null;
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const image = '/images/' + file.filename;
                const fullPath = path.join('public', 'images', file.filename);
                if (sharp && (w || h || sp)) {
                    const fullPath = path.join('public', 'images', file.filename);
                    try {
                        if (sp && sp > 0) {
                            const meta = await sharp(fullPath).metadata();
                            const sw = Math.max(1, Math.round((meta.width || 0) * sp / 100));
                            const sh = Math.max(1, Math.round((meta.height || 0) * sp / 100));
                            await sharp(fullPath).resize({
                                width: sw,
                                height: sh
                            }).toFile(fullPath + '.tmp');
                        } else if (w || h) {
                            await sharp(fullPath).resize({
                                width: w || undefined,
                                height: h || undefined,
                                fit: 'cover',
                                position: 'center'
                            }).toFile(fullPath + '.tmp');
                        }
                        // replace original
                        const fs = require('fs');
                        await fs.promises.rename(fullPath + '.tmp', fullPath);
                    } catch (e) {
                        console.error('Resize failed for', fullPath, e);
                    }
                }
                await CarouselImage.create({ image, title, caption });
            }
        }
        res.redirect('/admin/carousel');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding carousel image');
    }
});

router.get('/carousel/delete/:id', requireAuth, async (req, res) => {
    try {
        await CarouselImage.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/carousel');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/carousel');
    }
});

router.get('/chat', requireAuth, async (req, res) => {
    try {
        const sessions = await ChatSession.findAll({ order: [['started_at', 'DESC']] });
        res.render('admin/chat', { title: '在线咨询', sessions, current: null, messages: [] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading chat');
    }
});

router.get('/chat/:id', requireAuth, async (req, res) => {
    try {
        const sessions = await ChatSession.findAll({ order: [['started_at', 'DESC']] });
        const current = await ChatSession.findByPk(req.params.id);
        const messages = await ChatMessage.findAll({ where: { sessionId: req.params.id }, order: [['timestamp', 'ASC']] });
        res.render('admin/chat', { title: '在线咨询', sessions, current, messages });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading chat session');
    }
});

router.post('/chat/:id/message', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;
        if (content) {
            await ChatMessage.create({ sessionId: req.params.id, sender: 'admin', content });
        }
        res.redirect('/admin/chat/' + req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error sending message');
    }
});
module.exports = router;
