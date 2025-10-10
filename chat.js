class ChatManager {
    constructor() {
        this.currentChat = null;
        this.chats = [];
        this.apiBase = window.location.origin;
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.init();
    }

    init() {
        this.bindEvents();
        // WebSocket подключится после авторизации
    }

    bindEvents() {
        // Навигация
        document.getElementById('back-to-chats').addEventListener('click', () => this.showChatList());
        document.getElementById('back-from-profile').addEventListener('click', () => this.showChatList());
        
        // Отправка сообщений
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Поиск
        document.getElementById('search-toggle').addEventListener('click', () => this.toggleSearch());
        document.getElementById('chat-search').addEventListener('input', (e) => this.searchChats(e.target.value));
        
        // Вкладки чатов
        document.querySelectorAll('.chat-list-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.filterChats(e.target.dataset.tab));
        });
    }

    connectWebSocket() {
        if (!auth.getCurrentUser()) {
            console.log('WebSocket: Пользователь не авторизован');
            return;
        }

        try {
            // Определяем протокол WebSocket в зависимости от протокола страницы
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                
                // Аутентифицируем пользователя
                this.socket.send(JSON.stringify({
                    type: 'authenticate',
                    userId: auth.getCurrentUser().id
                }));
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    console.log(`WebSocket: Переподключение через ${delay}ms...`);
                    
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connectWebSocket();
                    }, delay);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            // Пинг каждые 30 секунд для поддержания соединения
            this.pingInterval = setInterval(() => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);

        } catch (error) {
            console.error('WebSocket connection error:', error);
        }
    }

    disconnectWebSocket() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    handleWebSocketMessage(data) {
        console.log('WebSocket message received:', data);
        
        switch (data.type) {
            case 'authenticated':
                console.log('WebSocket authenticated for user:', data.userId);
                break;
                
            case 'new_message':
                console.log('New message received:', data.message);
                this.handleNewMessage(data.message);
                break;
                
            case 'user_online':
                console.log('User online:', data.userId);
                this.updateUserStatus(data.userId, true);
                break;
                
            case 'user_offline':
                console.log('User offline:', data.userId);
                this.updateUserStatus(data.userId, false);
                break;
                
            case 'pong':
                // Ответ на пинг, ничего не делаем
                break;
                
            case 'error':
                console.error('WebSocket error:', data.message);
                break;
        }
    }

    async loadChats() {
        try {
            const response = await fetch(`${this.apiBase}/api/chats`, {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (response.ok) {
                this.chats = await response.json();
                this.renderChats();
            } else {
                console.error('Error loading chats:', response.status);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    renderChats() {
        const chatList = document.getElementById('chat-list');
        chatList.innerHTML = '';

        if (this.chats.length === 0) {
            chatList.innerHTML = '<div class="loading">Чатов пока нет</div>';
            return;
        }

        this.chats.forEach(chat => {
            const lastMessage = chat.lastMessage || { text: 'Нет сообщений', timestamp: new Date() };
            const time = this.formatTime(lastMessage.timestamp);
            const avatarText = chat.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

            const chatItem = document.createElement('li');
            chatItem.className = 'chat-item';
            chatItem.innerHTML = `
                <div class="chat-item-photo">${avatarText}</div>
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="name">${chat.name}</span>
                        <span class="time">${time}</span>
                    </div>
                    <div class="chat-item-message">
                        <p>${lastMessage.text}</p>
                    </div>
                </div>
            `;

            chatItem.addEventListener('click', () => this.openChat(chat));
            chatList.appendChild(chatItem);
        });
    }

    async openChat(chat) {
        this.currentChat = chat;
        
        // Обновляем заголовок чата
        document.getElementById('chat-with-name').textContent = chat.name;
        document.getElementById('chat-status').textContent = 'в сети';
        document.getElementById('chat-status').className = 'status-online';
        
        // Показываем экран чата
        app.showScreen('screen-chat');
        
        // Загружаем сообщения
        await this.loadMessages(chat.id);
        
        // Фокусируемся на поле ввода
        document.getElementById('message-input').focus();
    }

    async loadMessages(chatId) {
        try {
            const response = await fetch(`${this.apiBase}/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (response.ok) {
                const messages = await response.json();
                this.renderMessages(messages);
            } else {
                console.error('Error loading messages:', response.status);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';

        if (messages.length === 0) {
            chatMessages.innerHTML = '<div class="loading">Нет сообщений</div>';
            return;
        }

        let lastSenderId = null;
        
        messages.forEach((message, index) => {
            const isGrouped = lastSenderId === message.senderId && 
                              message.senderId !== auth.getCurrentUser().id;
            
            const messageElement = this.createMessageElement(message, isGrouped);
            chatMessages.appendChild(messageElement);
            
            lastSenderId = message.senderId;
        });

        // Прокручиваем вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    createMessageElement(message, isGrouped = false) {
        const container = document.createElement('div');
        const isSent = message.senderId === auth.getCurrentUser().id;
        
        container.className = `chat-message-container ${isSent ? 'sent' : 'received'}`;
        
        const time = this.formatTime(message.timestamp);
        const senderName = message.sender ? message.sender.fullname : 'Неизвестный';
        const avatarText = message.sender ? 
            message.sender.fullname.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 
            '??';

        if (isSent) {
            // Сообщения текущего пользователя - справа
            container.innerHTML = `
                <div class="chat-message-bubble">
                    ${message.text}
                </div>
                <div class="chat-message-time">${time}</div>
            `;
        } else {
            if (isGrouped) {
                // Сгруппированные сообщения - только текст и время
                container.innerHTML = `
                    <div class="message-sender-info grouped">
                        <div class="message-avatar-placeholder"></div>
                        <div class="message-content">
                            <div class="chat-message-bubble">
                                ${message.text}
                            </div>
                            <div class="chat-message-time">${time}</div>
                        </div>
                    </div>
                `;
            } else {
                // Первое сообщение в группе - с аватаром и именем
                container.innerHTML = `
                    <div class="message-sender-info">
                        <div class="message-avatar">${avatarText}</div>
                        <div class="message-content">
                            <div class="sender-name">${senderName}</div>
                            <div class="chat-message-bubble">
                                ${message.text}
                            </div>
                            <div class="chat-message-time">${time}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        return container;
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();

        if (!text || !this.currentChat) {
            console.log('No text or no current chat');
            return;
        }

        try {
            // Отправляем через WebSocket для реального времени
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'send_message',
                    chatId: this.currentChat.id,
                    text: text
                }));
                console.log('Message sent via WebSocket');
                
                // Очищаем поле ввода сразу для лучшего UX
                input.value = '';
                
                // Также отправляем через HTTP для надежности
                await this.sendMessageViaHTTP(text);
            } else {
                console.log('WebSocket not connected, using HTTP only');
                await this.sendMessageViaHTTP(text);
                input.value = '';
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Ошибка отправки сообщения');
        }
    }

    async sendMessageViaHTTP(text) {
        const response = await fetch(`${this.apiBase}/api/chats/${this.currentChat.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.getToken()}`
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            console.error('HTTP message send failed:', response.status);
            throw new Error('HTTP send failed');
        }

        const newMessage = await response.json();
        
        // Добавляем сообщение в интерфейс (для отправителя)
        const messageElement = this.createMessageElement(newMessage);
        document.getElementById('chat-messages').appendChild(messageElement);
        
        // Прокручиваем вниз
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Обновляем список чатов
        this.loadChats();
        
        return newMessage;
    }

    handleNewMessage(message) {
        console.log('Handling new message:', message);
        
        // Если сообщение для текущего открытого чата
        if (this.currentChat && message.chatId === this.currentChat.id) {
            console.log('Adding message to current chat');
            const messageElement = this.createMessageElement(message);
            document.getElementById('chat-messages').appendChild(messageElement);
            
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            console.log('Message for different chat or no current chat');
        }
        
        // Всегда обновляем список чатов для отображения последнего сообщения
        this.loadChats();
    }

    showChatList() {
        app.showScreen('screen-main');
        this.currentChat = null;
        this.loadChats();
    }

    toggleSearch() {
        const searchContainer = document.getElementById('search-container');
        const isVisible = searchContainer.style.display === 'block';
        searchContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            document.getElementById('chat-search').focus();
        }
    }

    searchChats(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        const searchTerm = query.toLowerCase();
        
        chatItems.forEach(item => {
            const name = item.querySelector('.name').textContent.toLowerCase();
            const message = item.querySelector('.chat-item-message p').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || message.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    filterChats(filter) {
        document.querySelectorAll('.chat-list-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${filter}"]`).classList.add('active');
        
        // В этой версии просто показываем все чаты
        // В будущем можно добавить фильтрацию по типам
        this.renderChats();
    }

    updateUserStatus(userId, isOnline) {
        if (this.currentChat && this.currentChat.participants.includes(userId)) {
            const statusElement = document.getElementById('chat-status');
            statusElement.textContent = isOnline ? 'в сети' : 'не в сети';
            statusElement.className = isOnline ? 'status-online' : 'status-offline';
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60 * 1000) {
            return 'только что';
        } else if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes} мин назад`;
        } else if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }
    }
}