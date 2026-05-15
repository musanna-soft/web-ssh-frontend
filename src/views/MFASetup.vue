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
    padding: 28px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}
h1 {
    margin: 0 0 4px;
    font-size: 1.6rem;
}
.sub {
    color: #aaa;
    margin: 0 0 24px;
    font-size: 0.95rem;
}
h2 {
    margin: 8px 0 8px;
    font-size: 1.05rem;
}
.hint {
    color: #aaa;
    font-size: 0.9rem;
    margin: 0 0 12px;
}
.warn {
    color: #fbbf24;
    font-size: 0.9rem;
    margin: 0 0 12px;
    line-height: 1.5;
}
.qr {
    display: block;
    width: 220px;
    height: 220px;
    margin: 14px auto;
    border-radius: 10px;
    background: #fff;
    padding: 8px;
}
.secret {
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    background: #1e1e1e;
    padding: 10px 12px;
    border-radius: 8px;
    text-align: center;
    word-break: break-all;
    margin: 0 0 16px;
    user-select: all;
}
input[type='tel'] {
    width: 100%;
    box-sizing: border-box;
    background: #1e1e1e;
    color: inherit;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    font-size: 1.4rem;
    letter-spacing: 4px;
    text-align: center;
    padding: 14px 16px;
    margin: 6px 0 10px;
    font-family: ui-monospace, monospace;
}
button {
    width: 100%;
    background: #2ea6ff;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 6px;
}
button.secondary {
    background: transparent;
    color: #2ea6ff;
}
button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.error {
    color: #ef4444;
    font-size: 0.85rem;
    margin: 6px 0 0;
    min-height: 1em;
}
.loading {
    color: #aaa;
    margin: 10px 0;
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
    to {
        transform: rotate(360deg);
    }
}
.codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 0 16px;
}
.codes code {
    font-family: ui-monospace, monospace;
    font-size: 0.95rem;
    background: #1e1e1e;
    padding: 9px 10px;
    border-radius: 6px;
    text-align: center;
    user-select: all;
}
</style>
