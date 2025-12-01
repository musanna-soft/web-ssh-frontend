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

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Clear token and redirect to login
            localStorage.removeItem('jwt_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
