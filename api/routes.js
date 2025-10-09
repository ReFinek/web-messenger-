// api/routes.js
import express from 'express';

const router = express.Router();

// Базовые маршруты API
router.get('/', (req, res) => {
    res.json({ message: 'API is working' });
});

// Добавьте здесь ваши реальные маршруты
router.get('/users', (req, res) => {
    res.json({ users: [] });
});

export default router;
