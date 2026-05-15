<template>
    <div class="callback-page">
        <div class="callback-card">
            <div class="spinner" aria-hidden="true"></div>
            <p>Authenticating…</p>
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
    const token = route.query.token;
    if (token) {
        authStore.setToken(token);
        router.push('/');
    } else {
        router.push('/login');
    }
});
</script>

<style scoped>
.callback-page {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: var(--bg-app);
}

.callback-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: var(--text-secondary);
    font-size: 14px;
}

.spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--border-default);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
