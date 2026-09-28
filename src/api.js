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

// 401 — sessiya tugadi.
//
// MFA bu yerda YO'Q va bo'lmasligi kerak: ikki bosqichli tasdiqlash musanna
// hisobining ishi (`me.musanna.uz`). Remofy'ning o'z MFA ekrani ikkinchi,
// mustaqil qulf bo'lardi — odam qaysi birini yoqqanini eslay olmasdi va
// ikkalasini alohida tiklashi kerak bo'lardi.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response && error.response.status;

        if (status === 401) {
            localStorage.removeItem('jwt_token');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default api;
