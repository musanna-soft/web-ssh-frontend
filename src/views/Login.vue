<template>
    <div class="login-page">
        <div class="login-card">
            <div class="brand">
                <div class="brand-mark">R</div>
                <h1>Remofy</h1>
            </div>
            <p class="tagline">Secure remote server management.</p>
            <button @click="loginWithGoogle" class="google-btn" type="button">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" aria-hidden="true" />
                <span>Sign in with Google</span>
            </button>
            <p class="fine-print">
                Hisobingiz orqali kirsangiz, xizmat shartlariga rozilik bildirgan bo'lasiz.
            </p>
        </div>
    </div>
</template>

<script setup>
const loginWithGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google/login`;
};
</script>

<style scoped>
.login-page {
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 24px;
    padding-top: max(24px, env(safe-area-inset-top));
    padding-bottom: max(24px, env(safe-area-inset-bottom));
    background:
        radial-gradient(1200px 600px at 20% -10%, rgba(110, 168, 255, 0.10), transparent 60%),
        radial-gradient(900px 600px at 100% 110%, rgba(110, 168, 255, 0.08), transparent 60%),
        var(--bg-app);
}

.login-card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    padding: 32px;
    box-shadow: var(--shadow-lg);
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.brand-mark {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 18px;
    box-shadow: var(--shadow-sm);
}

h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.02em;
}

.tagline {
    color: var(--text-secondary);
    margin: 4px 0 28px;
    font-size: 15px;
}

.google-btn {
    width: 100%;
    min-height: var(--tap-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: #fff;
    color: #18181b;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
    box-shadow: var(--shadow-sm);
}

.google-btn:hover {
    background: #f4f4f5;
}

.google-btn:active {
    transform: translateY(1px);
}

.google-btn img {
    width: 20px;
    height: 20px;
}

.fine-print {
    color: var(--text-tertiary);
    font-size: 12px;
    text-align: center;
    margin: 16px 0 0;
}

/* ── Phones ──────────────────────────────────────────────── */
@media (max-width: 480px) {
    .login-page { padding: 16px; }
    .login-card { padding: 24px 20px; border-radius: var(--radius-lg); }
    h1 { font-size: 24px; }
    .tagline { font-size: 14px; margin-bottom: 20px; }
    .google-btn { font-size: 16px; padding: 14px 16px; }
}
</style>
