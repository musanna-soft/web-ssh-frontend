<template>
    <div class="login-page">
        <div v-if="inApp.detected" class="inapp-banner" role="alert">
            <div class="inapp-icon" aria-hidden="true">⚠️</div>
            <div class="inapp-body">
                <div class="inapp-title">{{ inApp.appName }} ichki brauzeri aniqlandi</div>
                <p class="inapp-text">
                    Google bilan kirish bu yerda ishlamasligi mumkin.
                    Sahifani <b>{{ inApp.recommendedBrowser }}</b>'da oching:
                    <span class="inapp-hint">{{ inApp.howTo }}</span>
                </p>
                <div class="inapp-actions">
                    <button type="button" class="inapp-btn-secondary" @click="copyLink">
                        {{ copied ? '✓ Nusxa olindi' : 'Linkni nusxa olish' }}
                    </button>
                </div>
            </div>
        </div>

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

            <div class="divider"><span>yoki</span></div>

            <a href="https://t.me/remofybot" target="_blank" rel="noopener" class="tg-btn">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path fill="#fff" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                </svg>
                <span>Telegram botda davom ettirish — @remofybot</span>
            </a>
            <p class="tg-hint">
                Brauzersiz, to'g'ridan-to'g'ri Telegram orqali serverlaringizga ulanish.
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const loginWithGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google/login`;
};

// In-app brauzer aniqlash: shu webview'larda Google OAuth ishlamasligi mumkin
// (Google "disallowed_useragent" qaytaradi). Foydalanuvchini tashqi brauzerga
// yo'naltirish uchun banner ko'rsatamiz.
const detectInApp = () => {
    if (typeof navigator === 'undefined') return { detected: false };
    const ua = (navigator.userAgent || '') + ' ' + (navigator.vendor || '');
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    const patterns = [
        { name: 'Telegram',  re: /Telegram/i },
        { name: 'Instagram', re: /Instagram/i },
        { name: 'Facebook',  re: /FBAN|FBAV|FB_IAB|FBIOS/i },
        { name: 'TikTok',    re: /TikTok|musical_ly|BytedanceWebview/i },
        { name: 'LinkedIn',  re: /LinkedInApp/i },
        { name: 'Twitter',   re: /Twitter|TwitterAndroid/i },
        { name: 'WhatsApp',  re: /WhatsApp/i },
        { name: 'Snapchat',  re: /Snapchat/i },
        { name: 'WeChat',    re: /MicroMessenger/i },
        { name: 'Line',      re: /\bLine\//i },
    ];
    for (const p of patterns) {
        if (p.re.test(ua)) {
            const recommendedBrowser = isIOS ? 'Safari' : isAndroid ? 'Chrome' : 'tashqi brauzer';
            let howTo = '';
            if (p.name === 'Telegram') {
                howTo = isIOS
                    ? 'Tepa-o\'ngdagi ⋯ tugmasi → "Open in Safari"'
                    : isAndroid
                        ? 'Tepa-o\'ngdagi ⋮ tugmasi → "Open in external browser"'
                        : 'Linkni tashqi brauzerda oching';
            } else if (isIOS) {
                howTo = 'Pastdagi yoki yuqoridagi ⋯ menyusi → "Open in Safari"';
            } else if (isAndroid) {
                howTo = 'Menyu (⋮) → "Open in browser" / "Chrome"';
            } else {
                howTo = 'Linkni tashqi brauzerda oching';
            }
            return {
                detected: true,
                appName: p.name,
                recommendedBrowser,
                howTo,
            };
        }
    }
    return { detected: false };
};

const inApp = detectInApp();
const copied = ref(false);

const copyLink = async () => {
    const url = window.location.href;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
        } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        copied.value = true;
        setTimeout(() => (copied.value = false), 2000);
    } catch { /* sukut */ }
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

.divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0 14px;
    color: var(--text-tertiary);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.divider::before,
.divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border-subtle);
}

.tg-btn {
    width: 100%;
    min-height: var(--tap-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: #229ED9;
    color: #fff;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
    box-shadow: var(--shadow-sm);
}

.tg-btn:hover { background: #1d8ec3; }
.tg-btn:active { transform: translateY(1px); }

.tg-hint {
    color: var(--text-tertiary);
    font-size: 12px;
    text-align: center;
    margin: 10px 0 0;
}

.inapp-banner {
    width: 100%;
    max-width: 420px;
    margin-bottom: 16px;
    background: rgba(255, 196, 0, 0.08);
    border: 1px solid rgba(255, 196, 0, 0.35);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    box-shadow: var(--shadow-sm);
}

.inapp-icon { font-size: 20px; line-height: 1; padding-top: 2px; }
.inapp-body { flex: 1; min-width: 0; }
.inapp-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.inapp-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-secondary);
}
.inapp-hint {
    display: block;
    margin-top: 6px;
    color: var(--text-tertiary);
    font-size: 12px;
}

.inapp-actions { display: flex; gap: 8px; margin-top: 10px; }

.inapp-btn-secondary {
    appearance: none;
    background: transparent;
    border: 1px solid var(--border-default);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
}
.inapp-btn-secondary:hover { background: var(--bg-surface-2); }

@media (max-width: 480px) {
    .inapp-banner { padding: 12px 14px; }
    .inapp-title { font-size: 13px; }
    .inapp-text { font-size: 12px; }
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
