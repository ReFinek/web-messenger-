// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Статические файлы
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// API routes будут здесь
app.use('/api', await import('./api/routes.js'));

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