const sequelize = require('./database');
const AccessLog = require('./models/AccessLog');

async function seedLogs() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        
        const logs = [
            { ip: '1.1.1.1', country: 'CN', city: 'Beijing', path: '/', method: 'GET' },
            { ip: '1.1.1.1', country: 'CN', city: 'Beijing', path: '/products', method: 'GET' },
            { ip: '2.2.2.2', country: 'US', city: 'New York', path: '/', method: 'GET' },
            { ip: '2.2.2.2', country: 'US', city: 'New York', path: '/contact', method: 'GET' },
            { ip: '3.3.3.3', country: 'DE', city: 'Berlin', path: '/', method: 'GET' },
            { ip: '4.4.4.4', country: 'JP', city: 'Tokyo', path: '/', method: 'GET' },
            { ip: '5.5.5.5', country: 'CN', city: 'Shanghai', path: '/', method: 'GET' },
            { ip: '5.5.5.5', country: 'CN', city: 'Shanghai', path: '/about', method: 'GET' }
        ];

        for (const log of logs) {
            await AccessLog.create(log);
        }
        console.log('Access logs seeded!');
    } catch (err) {
        console.error('Error seeding logs:', err);
    }
}

seedLogs();
