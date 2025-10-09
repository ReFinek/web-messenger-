const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище сообщений (в памяти)
let messages = [];
let onlineUsers = new Map();

// Обработка подключений
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Отправляем историю сообщений новому пользователю
  socket.emit('messageHistory', messages);

  // Обработка входа пользователя
  socket.on('userJoin', (username) => {
    onlineUsers.set(socket.id, username);
    socket.broadcast.emit('userJoined', username);
    updateOnlineUsers();
  });

  // Обработка нового сообщения
  socket.on('sendMessage', (data) => {
    const message = {
      id: Date.now(),
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString()
    };
    
    messages.push(message);
    
    // Сохраняем только последние 100 сообщений
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
    
    // Отправляем сообщение всем подключенным
    io.emit('newMessage', message);
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      socket.broadcast.emit('userLeft', username);
      updateOnlineUsers();
    }
    console.log('Пользователь отключился:', socket.id);
  });

  function updateOnlineUsers() {
    const users = Array.from(onlineUsers.values());
    io.emit('onlineUsers', users);
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});