import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('jwt_token') || null,
        user: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
    },
    actions: {
        setToken(token) {
            this.token = token;
            localStorage.setItem('jwt_token', token);
        },
        logout() {
            this.token = null;
            this.user = null;
            localStorage.removeItem('jwt_token');
        },
        async fetchUser() {
            // In a real app, you'd have a /me endpoint
            // For now, we decode the token or just assume logged in
        }
    },
});
