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
                            Ishonchli qurilmalar: <b>{{ status.devices }}</b>
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
                        Ishonchli qurilmalar
                        <button class="link" @click="addDevice" v-if="canAddDevice">+ Yangi qurilma</button>
                    </h2>
                    <p v-if="!devices.length" class="hint">Hech qanday qurilma bog'lanmagan.</p>
                    <ul v-else class="devices">
                        <li v-for="d in devices" :key="d.id">
                            <div>
                                <b>{{ d.label || '(nomsiz)' }}</b>
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
    min-height: 100vh;
    background: #1e1e1e;
    color: #e7e9ea;
    display: flex;
    justify-content: center;
    padding: 40px 20px;
}
.card {
    background: #2d2d2d;
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 560px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}
h1 {
    margin: 0;
    font-size: 1.5rem;
}
h2 {
    font-size: 1rem;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.block {
    background: #262626;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 14px;
}
.block.highlight {
    background: #422006;
    border: 1px solid #78350f;
}
.block.danger-block {
    background: #2a0e0e;
    border: 1px solid #7f1d1d;
}
.status {
    list-style: none;
    padding: 0;
    margin: 0;
}
.status li {
    padding: 6px 0;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
}
.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
    display: inline-block;
}
.dot.ok { background: #22c55e; }
.dot.off { background: #ef4444; }
.dot.dim { background: #9ca3af; }
.devices {
    list-style: none;
    padding: 0;
    margin: 0;
}
.devices li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #383838;
}
.devices li:last-child {
    border-bottom: none;
}
.muted {
    color: #888;
    font-size: 0.8rem;
    margin-top: 2px;
}
.hint {
    color: #aaa;
    font-size: 0.85rem;
    margin: 4px 0 10px;
}
.warn {
    color: #fbbf24;
    font-size: 0.85rem;
    margin: 0 0 10px;
}
.error {
    color: #ef4444;
    font-size: 0.85rem;
    margin-top: 6px;
}
button {
    background: #2ea6ff;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
}
button.secondary {
    background: transparent;
    color: #2ea6ff;
}
button.danger {
    background: #ef4444;
}
button.warn {
    background: #f59e0b;
}
button.small {
    padding: 6px 10px;
    font-size: 0.8rem;
}
button.link {
    background: transparent;
    color: #2ea6ff;
    padding: 0;
    font-weight: 500;
    font-size: 0.9rem;
}
button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 10px 0;
}
.codes code {
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    background: #1e1e1e;
    padding: 8px 10px;
    border-radius: 6px;
    text-align: center;
    user-select: all;
}
.loading {
    color: #aaa;
}
.spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
