class ChatManager {
    constructor() {
        this.currentChat = null;
        this.chats = [];
        this.apiBase = window.location.origin;
        this.socket = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.connectWebSocket();
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
        this.socket = new WebSocket(`ws://${window.location.host.replace('http', 'ws')}/ws`);
        
        this.socket.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            // Переподключение через 5 секунд
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'new_message':
                this.handleNewMessage(data.message);
                break;
            case 'user_online':
                this.updateUserStatus(data.userId, true);
                break;
            case 'user_offline':
                this.updateUserStatus(data.userId, false);
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
            const avatarText = chat.name.split(' ').map(n => n[0]).join('').toUpperCase();

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
        app.methods.showScreen('screen-chat');
        
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
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    renderMessages(messages) {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';

        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            chatMessages.appendChild(messageElement);
        });

        // Прокручиваем вниз
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    createMessageElement(message) {
        const container = document.createElement('div');
        const isSent = message.senderId === auth.getCurrentUser().id;
        
        container.className = `chat-message-container ${isSent ? 'sent' : 'received'}`;
        
        const time = this.formatTime(message.timestamp);
        
        container.innerHTML = `
            <div class="chat-message-bubble">
                ${message.text}
            </div>
            <div class="chat-message-time">${time}</div>
        `;
        
        return container;
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();

        if (!text || !this.currentChat) return;

        try {
            const response = await fetch(`${this.apiBase}/api/chats/${this.currentChat.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify({ text })
            });

            if (response.ok) {
                input.value = '';
                
                // Отправляем через WebSocket для реального времени
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        type: 'send_message',
                        chatId: this.currentChat.id,
                        text: text
                    }));
                }
                
                // Перезагружаем чаты для обновления последнего сообщения
                this.loadChats();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    handleNewMessage(message) {
        if (this.currentChat && message.chatId === this.currentChat.id) {
            // Добавляем сообщение в текущий чат
            const messageElement = this.createMessageElement(message);
            document.getElementById('chat-messages').appendChild(messageElement);
            
            // Прокручиваем вниз
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        // Обновляем список чатов
        this.loadChats();
    }

    showChatList() {
        app.methods.showScreen('screen-main');
        this.currentChat = null;
        this.loadChats();
    }

    toggleSearch() {
        const searchContainer = document.getElementById('search-container');
        searchContainer.style.display = searchContainer.style.display === 'none' ? 'block' : 'none';
    }

    searchChats(query) {
        const chatItems = document.querySelectorAll('.chat-item');
        
        chatItems.forEach(item => {
            const name = item.querySelector('.name').textContent.toLowerCase();
            const message = item.querySelector('.chat-item-message p').textContent.toLowerCase();
            const searchTerm = query.toLowerCase();
            
            if (name.includes(searchTerm) || message.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    filterChats(filter) {
        // Обновляем активную вкладку
        document.querySelectorAll('.chat-list-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${filter}"]`).classList.add('active');
        
        // Здесь можно добавить фильтрацию по типам чатов
        // В демо-версии просто показываем все чаты
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
        
        if (diff < 24 * 60 * 60 * 1000) {
            // Сегодня
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * 24 * 60 * 60 * 1000) {
            // На этой неделе
            return date.toLocaleDateString('ru-RU', { weekday: 'short' });
        } else {
            // Ранее
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        }
    }
}