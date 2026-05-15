<template>
    <div class="mfa-page">
        <div class="card">
            <h1>MFA sozlash</h1>
            <p class="sub">Hisobingizni qurilma biometrikasi va bir martalik kod bilan himoyalang.</p>

            <!-- Step 1: QR + secret -->
            <section v-if="step === 'scan'">
                <h2>1-qadam: Authenticator ilovasiga skanerlang</h2>
                <p class="hint">
                    Microsoft Authenticator, Google Authenticator, Authy, 1Password, Bitwarden, Aegis
                    — har qaysisi ishlaydi.
                </p>
                <div v-if="loading" class="loading"><span class="spinner" /> Yuklanmoqda…</div>
                <img v-else-if="qr" :src="qr" alt="QR" class="qr" />
                <p v-if="secret" class="hint">Yoki kalitni qo'lda kiriting:</p>
                <code v-if="secret" class="secret">{{ secret }}</code>
                <button @click="step = 'verify'" :disabled="!qr">Davom etish</button>
            </section>

            <!-- Step 2: enter code -->
            <section v-else-if="step === 'verify'">
                <h2>2-qadam: 6-xonali kod</h2>
                <p class="hint">Authenticator ilovasi ko'rsatayotgan kodni kiriting.</p>
                <input
                    v-model="code"
                    type="tel"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                    placeholder="000000"
                    @keydown.enter="verify"
                />
                <button @click="verify" :disabled="submitting || code.length !== 6">
                    {{ submitting ? 'Tekshirilmoqda…' : 'Tasdiqlash' }}
                </button>
                <p v-if="error" class="error">{{ error }}</p>
                <button class="secondary" @click="step = 'scan'">Orqaga</button>
            </section>

            <!-- Step 3: recovery codes (shown ONCE) -->
            <section v-else-if="step === 'recovery'">
                <h2>Recovery kodlar</h2>
                <p class="warn">
                    Telefoningiz yo'qolsa shu kodlardan biri orqali kira olasiz. Har biri faqat
                    <b>bir marta</b> ishlaydi. Hozir saqlab oling — bu sahifa qayta ko'rsatilmaydi.
                </p>
                <div class="codes">
                    <code v-for="c in recoveryCodes" :key="c">{{ c }}</code>
                </div>
                <button @click="downloadRecovery">Faylga yuklab olish</button>
                <button class="secondary" @click="afterRecovery">Saqladim, davom etish</button>
            </section>

            <!-- Step 4: optional WebAuthn bind -->
            <section v-else-if="step === 'bind'">
                <h2>Qurilmangizni biometrikaga bog'lang</h2>
                <p class="hint">
                    FaceID / Touch ID / Windows Hello / PIN orqali ushbu qurilmani ishonchli qiling.
                    Keyingi safar 6-xonali kod talab qilinmaydi.
                </p>
                <button @click="bindDevice" :disabled="binding">
                    {{ binding ? 'Tasdiqlanmoqda…' : '🔐 Qurilmani bog\'lash' }}
                </button>
                <p v-if="bindError" class="error">{{ bindError }}</p>
                <button class="secondary" @click="finish">Keyingi safar</button>
            </section>

            <!-- Done -->
            <section v-else-if="step === 'done'">
                <h2>✅ Tayyor</h2>
                <p>Qurilma tasdiqlandi. Hisobingiz endi MFA bilan himoyalangan.</p>
                <button @click="goBack">Dashboard'ga qaytish</button>
            </section>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api.js';
import { useMFAStore } from '../stores/mfa.js';
import {
    isWebAuthnSupported,
    prepareCreateOptions,
    serializeAttestation,
    guessDeviceLabel,
} from '../webauthn.js';

const router = useRouter();
const mfa = useMFAStore();

const step = ref('scan');
const loading = ref(true);
const submitting = ref(false);
const binding = ref(false);

const qr = ref('');
const secret = ref('');
const code = ref('');
const error = ref('');
const bindError = ref('');
const recoveryCodes = ref([]);

onMounted(async () => {
    try {
        const { data } = await api.post('/mfa/totp/setup');
        qr.value = data.qr_data_url;
        secret.value = data.secret;
    } catch (e) {
        // 409 already_enrolled — bounce them to unlock.
        if (e.response && e.response.status === 409) {
            router.replace('/mfa/unlock');
            return;
        }
        error.value = formatError(e);
    } finally {
        loading.value = false;
    }
});

async function verify() {
    error.value = '';
    if (!/^\d{6}$/.test(code.value)) {
        error.value = 'Kod 6 raqamdan iborat bo\'lishi kerak';
        return;
    }
    submitting.value = true;
    try {
        const { data } = await api.post('/mfa/totp/verify', { code: code.value });
        if (data.recovery_codes && data.recovery_codes.length) {
            recoveryCodes.value = data.recovery_codes;
            mfa.setRecoveryCodes(data.recovery_codes);
            step.value = 'recovery';
        } else {
            afterRecovery();
        }
    } catch (e) {
        error.value = formatError(e);
    } finally {
        submitting.value = false;
    }
}

function afterRecovery() {
    if (isWebAuthnSupported()) {
        step.value = 'bind';
    } else {
        step.value = 'done';
    }
}

async function bindDevice() {
    bindError.value = '';
    binding.value = true;
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
        step.value = 'done';
    } catch (e) {
        bindError.value = formatError(e);
    } finally {
        binding.value = false;
    }
}

function finish() {
    step.value = 'done';
}

function downloadRecovery() {
    const blob = new Blob(
        [
            'Remofy recovery codes\n',
            'Generated: ' + new Date().toISOString() + '\n',
            'Each code works once. Keep this file safe.\n\n',
            recoveryCodes.value.join('\n') + '\n',
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

function goBack() {
    const next = router.currentRoute.value.query.next || '/';
    router.replace(next);
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
    min-height: 100dvh;
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
    padding: 28px;
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-lg);
    height: fit-content;
}

h1 {
    margin: 0 0 6px;
    font-size: 22px;
    letter-spacing: -0.01em;
}

.sub {
    color: var(--text-secondary);
    margin: 0 0 24px;
    font-size: 14px;
}

h2 {
    margin: 18px 0 8px;
    font-size: 15px;
    color: var(--text-primary);
}

section:first-of-type h2 { margin-top: 4px; }

.hint {
    color: var(--text-secondary);
    font-size: 13px;
    margin: 0 0 12px;
    line-height: 1.5;
}

.warn {
    color: var(--warning);
    font-size: 13px;
    margin: 0 0 12px;
    line-height: 1.5;
}

.qr {
    display: block;
    width: 220px;
    height: 220px;
    margin: 14px auto;
    border-radius: var(--radius-md);
    background: #fff;
    padding: 8px;
}

.secret {
    display: block;
    font-family: var(--font-mono);
    font-size: 14px;
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    padding: 12px 14px;
    border-radius: var(--radius-md);
    text-align: center;
    word-break: break-all;
    margin: 0 0 16px;
    user-select: all;
    letter-spacing: 0.08em;
    color: var(--text-primary);
}

input[type='tel'] {
    width: 100%;
    background: var(--bg-app);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    font-size: 22px;
    letter-spacing: 8px;
    text-align: center;
    padding: 14px 16px;
    margin: 6px 0 10px;
    font-family: var(--font-mono);
    transition: border-color var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
}

input[type='tel']:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
}

button {
    width: 100%;
    min-height: var(--tap-target);
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
    margin-top: 8px;
}

button:hover {
    background: var(--accent-hover);
}

button:active {
    transform: translateY(1px);
}

button.secondary {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--border-default);
}

button.secondary:hover {
    background: var(--accent-soft);
    border-color: var(--accent);
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.error {
    color: var(--danger);
    font-size: 13px;
    margin: 8px 0 0;
    min-height: 1em;
}

.loading {
    color: var(--text-secondary);
    margin: 10px 0;
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

.codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 0 16px;
}

.codes code {
    font-family: var(--font-mono);
    font-size: 14px;
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    padding: 10px;
    border-radius: var(--radius-sm);
    text-align: center;
    user-select: all;
    color: var(--text-primary);
}

/* ── Phones ──────────────────────────────────────────────── */
@media (max-width: 480px) {
    .mfa-page { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); }
    .card { padding: 20px; border-radius: var(--radius-lg); }
    h1 { font-size: 20px; }
    .qr { width: 200px; height: 200px; }
    .codes { grid-template-columns: 1fr; }
    input[type='tel'] { font-size: 22px; letter-spacing: 6px; }
}
</style>
