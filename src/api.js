import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`, // Backend URL from environment variable
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle 401 + 403 mfa_required.
api.interceptors.response.use(
    (response) => {
        // Surface MFA grace-period info if the server attached it. The
        // store is imported lazily to avoid loading Pinia before the app
        // has mounted (api.js is imported very early).
        const grace = response.headers && response.headers['x-mfa-grace-until'];
        if (grace) {
            import('./stores/mfa.js').then(({ useMFAStore }) => {
                try {
                    useMFAStore().setGraceUntil(grace);
                } catch (_) {
                    // Pinia not ready yet — ignore.
                }
            });
        }
        return response;
    },
    (error) => {
        const status = error.response && error.response.status;

        if (status === 401) {
            localStorage.removeItem('jwt_token');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        if (status === 403) {
            const body = error.response.data || {};
            const mfaHeader = error.response.headers
                ? error.response.headers['x-mfa-required']
                : null;
            if (body.error === 'mfa_required' || mfaHeader === '1') {
                const enrolled = !!body.enrolled;
                const target = enrolled ? '/mfa/unlock' : '/mfa/setup';
                // Don't redirect-loop when we're already on the MFA pages.
                if (!window.location.pathname.startsWith('/mfa/')) {
                    window.location.href = target;
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
