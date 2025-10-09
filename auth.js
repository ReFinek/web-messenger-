// ЗАМЕНИТЬ auth.js на:
class AuthManager {
    static currentUser = null;
    
    static async login(username, avatar = null) {
        try {
            // Генерируем уникальный ID для пользователя
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const userData = {
                id: userId,
                username: username,
                name: username,
                avatar: avatar || this.generateAvatar(username),
                color: this.generateColor(username),
                isOnline: true,
                lastOnline: Date.now(),
                status: 'в сети',
                registeredAt: Date.now()
            };
            
            // Сохраняем в localStorage
            this.currentUser = userData;
            localStorage.setItem('telegram-user', JSON.stringify(userData));
            
            // Регистрируем пользователя на сервере (если есть бэкенд)
            await this.registerUserOnServer(userData);
            
            return userData;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    
    static async registerUserOnServer(userData) {
        try {
            // Если есть бэкенд - регистрируем пользователя
            if (typeof TelegramAPI !== 'undefined') {
                await TelegramAPI.registerUser(userData);
            }
        } catch (error) {
            console.warn('Server registration failed, using local mode:', error);
        }
    }
    
    static generateAvatar(username) {
        // Создаем аватар из первых букв имени
        const words = username.split(' ');
        let initials = '';
        
        if (words.length >= 2) {
            initials = words[0].charAt(0) + words[1].charAt(0);
        } else {
            initials = username.substring(0, 2);
        }
        
        return initials.toUpperCase();
    }
    
    static generateColor(username) {
        // Генерируем цвет на основе имени для консистентности
        const colors = [
            'linear-gradient(135deg, #ff6b6b, #ee5a52)',
            'linear-gradient(135deg, #48dbfb, #0abde3)',
            'linear-gradient(135deg, #1dd1a1, #10ac84)',
            'linear-gradient(135deg, #f368e0, #ff9ff3)',
            'linear-gradient(135deg, #ff9f43, #feca57)',
            'linear-gradient(135deg, #54a0ff, #2e86de)',
            'linear-gradient(135deg, #5f27cd, #341f97)'
        ];
        
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    static logout() {
        this.currentUser = null;
        localStorage.removeItem('telegram-user');
        localStorage.removeItem('telegram-chats');
        localStorage.removeItem('telegram-messages');
        localStorage.removeItem('telegram-contacts');
    }
    
    static getCurrentUser() {
        if (!this.currentUser) {
            const saved = localStorage.getItem('telegram-user');
            if (saved) {
                this.currentUser = JSON.parse(saved);
            }
        }
        return this.currentUser;
    }
    
    static isAuthenticated() {
        return !!this.getCurrentUser();
    }
    
    static async uploadAvatar(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            reader.readAsDataURL(file);
        });
    }
}