const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const CarouselImage = require('../models/CarouselImage');
const ProductImage = require('../models/ProductImage');
const { Op } = require('sequelize');
const Category = require('../models/Category');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');

router.get('/', async (req, res) => {
    try {
        const featuredProducts = await Product.findAll({ limit: 3 });
        const carouselImages = await CarouselImage.findAll({ order: [['id', 'DESC']], limit: 6 });
        res.render('index', { title: '首页', products: featuredProducts, carouselImages });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/products', async (req, res) => {
    try {
        const categoryParam = req.query.category || req.query.cat || null;
        const whereClause = categoryParam ? {
            [Op.or]: [
                { category: categoryParam },
                { category_en: categoryParam }
            ]
        } : {};

        const [products, categories] = await Promise.all([
            Product.findAll({ where: whereClause }),
            Category.findAll()
        ]);

        // Build category stats (counts)
        const categoryStats = [];
        for (const cat of categories) {
            const count = await Product.count({ where: { category: cat.name } });
            categoryStats.push({
                name: cat.name,
                name_en: cat.name_en,
                count
            });
        }

        res.render('products', { 
            title: '产品中心', 
            products, 
            categories: categoryStats, 
            selectedCategory: categoryParam 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        const mainImages = await ProductImage.findAll({ where: { productId: req.params.id, is_main: true } });
        const galleryImages = await ProductImage.findAll({ where: { productId: req.params.id, is_main: false } });
        if (product) {
            res.render('product_detail', { title: product.name, product: product, mainImages, galleryImages });
        } else {
            res.status(404).send('Product not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.get('/about', (req, res) => {
    res.render('about', { title: '关于我们' });
});

router.get('/contact', (req, res) => {
    res.render('contact', { title: '联系我们', query: req.query || {} });
});

router.post('/contact/message', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const phone = req.body.phone || '';
        const ChatSession = require('../models/ChatSession');
        const ChatMessage = require('../models/ChatMessage');
        const session = await ChatSession.create({ company: name, interested_product: '', phone, email, status: 'open' });
        await ChatMessage.create({ sessionId: session.id, sender: 'visitor', content: message });
        req.session.chatSessionId = session.id;
        res.redirect('/contact?message_success=1');
    } catch (err) {
        console.error(err);
        res.redirect('/contact?message_success=0');
    }
});
router.post('/chat/start', async (req, res) => {
    try {
        const { company, interested_product, phone, email } = req.body;
        const session = await ChatSession.create({ company, interested_product, phone, email, status: 'open' });
        req.session.chatSessionId = session.id;
        res.json({ ok: true, sessionId: session.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false });
    }
});

router.get('/chat/messages', async (req, res) => {
    try {
        const sessionId = req.session.chatSessionId;
        if (!sessionId) return res.json({ ok: true, messages: [] });
        const messages = await ChatMessage.findAll({ where: { sessionId }, order: [['timestamp', 'ASC']] });
        res.json({ ok: true, messages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, messages: [] });
    }
});

router.post('/chat/message', async (req, res) => {
    try {
        const sessionId = req.session.chatSessionId;
        const { content } = req.body;
        if (!sessionId || !content) return res.json({ ok: false });
        await ChatMessage.create({ sessionId, sender: 'visitor', content });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false });
    }
});

router.get('/services', async (req, res) => {
    try {
        let resources = [];
        try {
            const SupportResource = require('../models/SupportResource');
            resources = await SupportResource.findAll({ order: [['id', 'DESC']] });
        } catch (e) {
            resources = [];
        }
        res.render('services', { title: '服务与支持', resources });
    } catch (err) {
        console.error(err);
        res.render('services', { title: '服务与支持', resources: [] });
    }
});

module.exports = router;
