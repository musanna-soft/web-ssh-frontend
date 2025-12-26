<template>
    <div class="login-container">
        <div class="login-card">
            <h1>Remofy</h1>
            <p>Secure remote server management platform.</p>
            <button @click="loginWithGoogle" class="google-btn">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" />
                Sign in with Google
            </button>
        </div>
    </div>
</template>

<script setup>
const loginWithGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google/login`;
};
</script>

<style scoped>
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #1e1e1e;
    color: #ffffff;
}

.login-card {
    background-color: #2d2d2d;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
}

h1 {
    margin-bottom: 0.5rem;
    font-size: 2rem;
}

p {
    margin-bottom: 2rem;
    color: #aaaaaa;
}

.google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background-color: #ffffff;
    color: #333;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
}

.google-btn:hover {
    background-color: #f1f1f1;
}

.google-btn img {
    width: 20px;
    height: 20px;
}

@media (max-width: 480px) {
    .login-card {
        padding: 1.5rem;
    }

    h1 {
        font-size: 1.5rem;
    }

    p {
        font-size: 0.9rem;
    }

    .google-btn {
        font-size: 0.9rem;
        padding: 8px 16px;
    }
}
</style>
