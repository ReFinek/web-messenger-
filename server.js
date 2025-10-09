// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors'; // ДОБАВЛЕНО: Импорт CORS

// Импортируйте routes правильно
import apiRoutes from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ДОБАВЛЕНО: Используем CORS для Express, чтобы разрешить запросы с других доменов
app.use(cors());

const server = createServer(app);

// Настройка Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем всем доменам подключаться к сокетам
        methods: ["GET", "POST"]
    }
});

// Статические файлы
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// КРИТИЧЕСКИ ВАЖНЫЙ КОД ДЛЯ ФРОНТЕНДА (Маршрут-заглушка для SPA)
// Он должен быть ПОСЛЕ всех API-маршрутов
app.get('*', (req, res) => {
    // Для всех остальных GET-запросов (т.е. маршрутов фронтенда) 
    // возвращаем index.html из папки dist.
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// WebSocket для реального времени
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('auth', (token) => {
        // Проверка токена и подписка на события
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
