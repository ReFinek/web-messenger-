// api.js
class TelegramAPI {
    static baseURL = 'https://your-render-app.onrender.com/api'; // Заменить на ваш URL
    
    static async request(endpoint, options = {}) {
        const token = localStorage.getItem('telegram-token');
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            if (response.status === 401) {
                AuthManager.logout();
                window.location.reload();
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    // Пользователи
    static async getUsers() {
        return await this.request('/users');
    }
    
    static async getUser(userId) {
        return await this.request(`/users/${userId}`);
    }
    
    static async searchUsers(query) {
        return await this.request(`/users/search?q=${encodeURIComponent(query)}`);
    }
    
    // Чаты
    static async getChats() {
        return await this.request('/chats');
    }
    
    static async getChat(chatId) {
        return await this.request(`/chats/${chatId}`);
    }
    
    static async createChat(userIds, title = null) {
        return await this.request('/chats', {
            method: 'POST',
            body: JSON.stringify({ userIds, title })
        });
    }
    
    // Сообщения
    static async getMessages(chatId, limit = 50, offset = 0) {
        return await this.request(`/chats/${chatId}/messages?limit=${limit}&offset=${offset}`);
    }
    
    static async sendMessage(chatId, text, replyTo = null) {
        return await this.request(`/chats/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ text, replyTo })
        });
    }
    
    static async deleteMessage(chatId, messageId) {
        return await this.request(`/chats/${chatId}/messages/${messageId}`, {
            method: 'DELETE'
        });
    }
    
    // Контакты
    static async getContacts() {
        return await this.request('/contacts');
    }
    
    static async addContact(userId) {
        return await this.request('/contacts', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    }
    
    static async removeContact(contactId) {
        return await this.request(`/contacts/${contactId}`, {
            method: 'DELETE'
        });
    }
    
    // Файлы
    static async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.baseURL}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('telegram-token')}`
            },
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        return await response.json();
    }
}