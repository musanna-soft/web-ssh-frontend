<template>
    <div class="mfa-page">
        <div class="card">
            <div class="head">
                <h1>MFA boshqaruvi</h1>
                <button class="link" @click="router.back()">← Orqaga</button>
            </div>

            <div v-if="loading" class="loading"><span class="spinner" /> Yuklanmoqda…</div>

            <template v-else>
                <!-- Summary -->
                <section class="block">
                    <h2>Holat</h2>
                    <ul class="status">
                        <li>
                            <span :class="['dot', status.enrolled ? 'ok' : 'off']" />
                            TOTP: <b>{{ status.enrolled ? 'yoqilgan' : 'yoqilmagan' }}</b>
                        </li>
                        <li>
                            <span :class="['dot', status.active ? 'ok' : 'off']" />
                            Aktiv sessiya: <b>{{ status.active ? 'bor' : 'yo\'q' }}</b>
                        </li>
                        <li>
                            <span class="dot dim" />
                            Passkey qurilmalar: <b>{{ status.devices }}</b>
                        </li>
                        <li>
                            <span class="dot dim" />
                            PIN qurilmalar: <b>{{ pinDevices.length }}</b>
                        </li>
                        <li>
                            <span class="dot dim" />
                            Recovery kodlar (qolgan):
                            <b>{{ status.recovery_remaining }}</b>
                        </li>
                        <li v-if="!status.enrolled">
                            <router-link to="/mfa/setup" class="link">→ Hozir sozlash</router-link>
                        </li>
                    </ul>
                </section>

                <!-- Devices -->
                <section class="block" v-if="status.enrolled">
                    <h2>
                        Ishonchli qurilmalar (passkey)
                        <button class="link" @click="addDevice" v-if="canAddDevice">+ Yangi qurilma</button>
                    </h2>
                    <p v-if="!devices.length" class="hint">Hech qanday passkey qurilma bog'lanmagan.</p>
                    <ul v-else class="devices">
                        <li v-for="d in devices" :key="d.id">
                            <div>
                                <b>🔐 {{ d.label || '(nomsiz)' }}</b>
                                <div class="muted">
                                    Qo'shilgan: {{ formatDate(d.created_at) }} ·
                                    Oxirgi: {{ formatDate(d.last_used_at) || '—' }}
                                </div>
                            </div>
                            <button class="danger small" @click="revoke(d.id)" :disabled="busy">
                                Bekor qilish
                            </button>
                        </li>
                    </ul>
                    <p v-if="bindError" class="error">{{ bindError }}</p>
                </section>

                <!-- PIN Devices (Telegram mobile / wallet-style) -->
                <section class="block" v-if="status.enrolled">
                    <h2>PIN qurilmalar (Telegram)</h2>
                    <p v-if="!pinDevices.length" class="hint">
                        Bu yerda Telegram mobile orqali ro'yxatga olingan PIN qurilmalar ko'rinadi.
                        Telegram bot Mini App'da PIN o'rnatish mumkin.
                    </p>
                    <ul v-else class="devices">
                        <li v-for="d in pinDevices" :key="'pin-' + d.id">
                            <div>
                                <b>🔢 {{ d.label || '(nomsiz)' }}</b>
                                <div class="muted">
                                    Telegram: {{ d.telegram_id }} ·
                                    Qo'shilgan: {{ formatDate(d.created_at) }} ·
                                    Oxirgi: {{ formatDate(d.last_used_at) || '—' }}
                                </div>
                            </div>
                            <button class="danger small" @click="revokePin(d.id)" :disabled="busy">
                                Bekor qilish
                            </button>
                        </li>
                    </ul>
                </section>

                <!-- Recovery -->
                <section class="block" v-if="status.enrolled">
                    <h2>Recovery kodlar</h2>
                    <p class="hint">
                        Qolgan: <b>{{ status.recovery_remaining }}</b>.
                        Yangilash eskilarini bekor qiladi va 10 ta yangi kod beradi.
                    </p>
                    <button @click="regenerate" :disabled="busy || !status.active">
                        🔄 Yangilash
                    </button>
                    <p v-if="!status.active" class="hint">
                        Yangilash uchun aktiv MFA sessiya kerak — avval qulfni oching.
                    </p>
                </section>

                <!-- Lock -->
                <section class="block" v-if="status.enrolled && status.active">
                    <h2>Sessiyani yopish</h2>
                    <p class="hint">
                        Joriy 30-daqiqalik unlock'ni bekor qilasiz. Keyingi so'rovda qaytadan
                        tasdiqlash kerak bo'ladi.
                    </p>
                    <button class="warn" @click="lock" :disabled="busy">🔒 Hozir qulflash</button>
                </section>

                <!-- Reset -->
                <section class="block danger-block" v-if="status.enrolled && status.active">
                    <h2>MFA ni qayta sozlash</h2>
                    <p class="warn">
                        TOTP secret, recovery kodlar va barcha biometrik qurilmalar
                        o'chiriladi. Keyin MFA'ni noldan sozlashingiz kerak bo'ladi. Bu
                        eski qurilmalardagi passkey'lar ishlamay qolganda foydali.
                    </p>
                    <button class="danger" @click="resetMFA" :disabled="busy">
                        ⚠️ Hammasini qayta o'rnatish
                    </button>
                </section>

                <!-- New recovery codes (after regenerate) -->
                <section v-if="newCodes.length" class="block highlight">
                    <h2>⚠️ Yangi recovery kodlar</h2>
                    <p class="warn">
                        Eskilari bekor qilindi. Quyidagilarni hozir saqlab oling — qayta
                        ko'rsatilmaydi.
                    </p>
                    <div class="codes">
                        <code v-for="c in newCodes" :key="c">{{ c }}</code>
                    </div>
                    <button @click="downloadCodes">Faylga yuklab olish</button>
                    <button class="secondary" @click="newCodes = []">Yashirish</button>
                </section>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api.js';
import {
    isWebAuthnSupported,
    prepareCreateOptions,
    serializeAttestation,
    guessDeviceLabel,
} from '../webauthn.js';

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const busy = ref(false);
const status = ref({ enrolled: false, active: false, devices: 0, recovery_remaining: 0 });
const devices = ref([]);
const pinDevices = ref([]);
const newCodes = ref([]);
const bindError = ref('');

const canAddDevice = computed(() => status.value.active && isWebAuthnSupported());

onMounted(async () => {
    await refresh();
    // Auto-open the add-device prompt when MFAUnlock redirected here after
    // a TOTP unlock with no credentials registered. We only trigger once
    // per page load — bindDevice's failure cases (cancelled, etc.) leave
    // the user in control.
    if (route.query.bind === '1' && canAddDevice.value) {
        await addDevice();
    }
});

async function refresh() {
    loading.value = true;
    try {
        const { data: s } = await api.post('/mfa/status');
        status.value = s;
        const { data: d } = await api.get('/mfa/devices');
        devices.value = d.devices || [];
        // PIN devices live in their own endpoint. Failures are non-fatal:
        // a fresh deploy where pin_devices doesn't exist yet shouldn't
        // break the whole settings page.
        try {
            const { data: p } = await api.get('/mfa/pin/devices');
            pinDevices.value = p.devices || [];
        } catch (_) {
            pinDevices.value = [];
        }
    } catch (e) {
        // 401/403 already handled by interceptor.
    } finally {
        loading.value = false;
    }
}

async function addDevice() {
    bindError.value = '';
    busy.value = true;
    try {
        const { data: begin } = await api.post('/mfa/webauthn/register/begin');
        const opts = prepareCreateOptions(begin.options);
        const cred = await navigator.credentials.create({ publicKey: opts });
        if (!cred) throw new Error('Bekor qilindi');
        await api.post('/mfa/webauthn/register/finish', {
            handle: begin.handle,
            body: serializeAttestation(cred),
            label: guessDeviceLabel(),
        });
        await refresh();
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function revoke(id) {
    if (!confirm("Ushbu qurilmani bekor qilishni xohlaysizmi?")) return;
    busy.value = true;
    try {
        await api.delete(`/mfa/devices/${id}`);
        await refresh();
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function revokePin(id) {
    if (!confirm("Ushbu PIN qurilmani bekor qilishni xohlaysizmi?")) return;
    busy.value = true;
    try {
        await api.delete(`/mfa/pin/devices/${id}`);
        await refresh();
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function regenerate() {
    if (!confirm("Eski recovery kodlar bekor qilinadi va 10 ta yangi yaratiladi. Davom etamizmi?")) return;
    busy.value = true;
    try {
        const { data } = await api.post('/mfa/recovery/regenerate');
        newCodes.value = data.recovery_codes || [];
        await refresh();
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function lock() {
    if (!confirm("Sessiyani yopasizmi?")) return;
    busy.value = true;
    try {
        await api.post('/mfa/lock');
        await refresh();
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function resetMFA() {
    const confirmed = confirm(
        "TOTP, recovery kodlar va barcha biometrik qurilmalar O'CHIRILADI. " +
        "Davom etamizmi? Keyin MFA'ni qaytadan sozlash kerak bo'ladi."
    );
    if (!confirmed) return;
    busy.value = true;
    try {
        await api.post('/mfa/reset');
        // After reset the next API call will 403 with enrolled=false and
        // the global interceptor sends us to /mfa/setup. Do it explicitly
        // so the user doesn't see a flash of the now-empty settings page.
        router.replace('/mfa/setup');
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

function downloadCodes() {
    const blob = new Blob(
        [
            'Remofy recovery codes\n',
            'Generated: ' + new Date().toISOString() + '\n',
            'Each code works once. Keep this file safe.\n\n',
            newCodes.value.join('\n') + '\n',
        ],
        { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remofy-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function formatDate(s) {
    if (!s) return '';
    try {
        return new Date(s).toISOString().slice(0, 10);
    } catch {
        return s;
    }
}

function formatError(e) {
    if (e.response && e.response.data) {
        if (typeof e.response.data === 'string') return e.response.data;
        if (e.response.data.error) return e.response.data.error;
    }
    return e.message || 'Xatolik';
}
</script>

<style scoped>
.mfa-page {
    height: 100dvh;
    background: var(--bg-app);
    color: var(--text-primary);
    display: flex;
    justify-content: center;
    padding: 32px 20px;
    padding-top: max(32px, env(safe-area-inset-top));
    padding-bottom: max(32px, env(safe-area-inset-bottom));
    overflow-y: auto;
}

.card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    padding: 24px;
    width: 100%;
    max-width: 560px;
    box-shadow: var(--shadow-lg);
    height: fit-content;
}

.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
}

h1 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.01em;
}

h2 {
    font-size: 14px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.block {
    background: var(--bg-surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 16px 18px;
    margin-bottom: 14px;
}

.block.highlight {
    background: rgba(245, 158, 11, 0.10);
    border-color: rgba(245, 158, 11, 0.45);
}

.block.danger-block {
    background: var(--danger-soft);
    border-color: rgba(239, 68, 68, 0.45);
}

.status {
    list-style: none;
    padding: 0;
    margin: 0;
}

.status li {
    padding: 6px 0;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-secondary);
}

.status li b { color: var(--text-primary); }

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-tertiary);
    flex-shrink: 0;
}

.dot.ok { background: var(--success); }
.dot.off { background: var(--danger); }
.dot.dim { background: var(--text-tertiary); }

.devices {
    list-style: none;
    padding: 0;
    margin: 0;
}

.devices li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);
}

.devices li:last-child { border-bottom: none; }
.devices li > div:first-child { min-width: 0; flex: 1 1 auto; }
.devices li b { color: var(--text-primary); font-size: 14px; }

.muted {
    color: var(--text-tertiary);
    font-size: 12px;
    margin-top: 2px;
}

.hint {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 4px 0 10px;
    line-height: 1.5;
}

.warn {
    color: var(--warning);
    font-size: 13px;
    margin: 0 0 10px;
    line-height: 1.5;
}

.error {
    color: var(--danger);
    font-size: 13px;
    margin-top: 8px;
}

button {
    min-height: 38px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 9px 14px;
    font-size: 14px;
    font-weight: 600;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
}

button:hover { background: var(--accent-hover); }
button:active { transform: translateY(1px); }

button.secondary {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--border-default);
}

button.secondary:hover {
    background: var(--accent-soft);
    border-color: var(--accent);
}

button.danger { background: var(--danger); }
button.danger:hover { background: var(--danger-hover); }

button.warn { background: var(--warning); }
button.warn:hover { background: #fbbf24; }

button.small {
    min-height: 32px;
    padding: 6px 10px;
    font-size: 12px;
    flex-shrink: 0;
}

button.link {
    background: transparent;
    color: var(--accent);
    padding: 0;
    min-height: auto;
    font-weight: 500;
    font-size: 13px;
}

button.link:hover { color: var(--accent-hover); background: transparent; transform: none; }

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 0;
}

.codes code {
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    padding: 10px;
    border-radius: var(--radius-sm);
    text-align: center;
    user-select: all;
    color: var(--text-primary);
}

.loading {
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ── Phones ──────────────────────────────────────────────── */
@media (max-width: 480px) {
    .mfa-page { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); }
    .card { padding: 18px; border-radius: var(--radius-lg); }
    h1 { font-size: 20px; }
    .codes { grid-template-columns: 1fr; }
    .devices li {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }
    .devices li button.small { width: 100%; }
}
</style>
