// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Импортируйте routes правильно
import apiRoutes from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Статические файлы (должны быть первыми, чтобы обслуживать CSS/JS/картинки)
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// *******************************************************************
// КРИТИЧЕСКИ ВАЖНЫЙ КОД ДЛЯ ФРОНТЕНДА
// Для всех остальных GET-запросов (т.е. маршрутов фронтенда, которые не API) 
// возвращаем index.html. Это нужно для клиентской маршрутизации (SPA).
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// *******************************************************************


// WebSocket для реального времени
io.on('connection', (socket) => {
// ...
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
