<template>
    <div class="mfa-page">
        <div class="card">
            <h1>Qurilmani tasdiqlang</h1>
            <p class="sub">Sessiya muddati o'tdi — qaytadan kirish kerak.</p>

            <!-- Default: WebAuthn if supported & user has devices -->
            <section v-if="mode === 'webauthn'">
                <p class="hint">Qurilmangiz unlock'i (FaceID / Touch ID / Windows Hello / PIN) so'raladi.</p>
                <button @click="unlockWebAuthn" :disabled="busy">
                    {{ busy ? 'Tasdiqlanmoqda…' : '🔐 Biometrik bilan kirish' }}
                </button>
                <p v-if="error" class="error">{{ error }}</p>
                <button class="secondary" @click="mode = 'totp'">Authenticator kodini ishlatish</button>
                <button class="secondary" @click="mode = 'recovery'">Recovery kod orqali kirish</button>
            </section>

            <!-- TOTP -->
            <section v-else-if="mode === 'totp'">
                <p class="hint">Authenticator ilovasidan 6-xonali kodni kiriting.</p>
                <input
                    v-model="code"
                    type="tel"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                    placeholder="000000"
                    @keydown.enter="unlockTotp"
                />
                <button @click="unlockTotp" :disabled="busy || code.length !== 6">
                    {{ busy ? 'Tekshirilmoqda…' : 'Kirish' }}
                </button>
                <p v-if="error" class="error">{{ error }}</p>
                <button v-if="webauthnAvailable" class="secondary" @click="mode = 'webauthn'">
                    Biometrik bilan kirish
                </button>
                <button class="secondary" @click="mode = 'recovery'">Recovery kod ishlatish</button>
            </section>

            <!-- Recovery code -->
            <section v-else-if="mode === 'recovery'">
                <p class="hint">Enrollment paytida saqlagan recovery kodlardan birini kiriting.</p>
                <input
                    v-model="recoveryCode"
                    type="text"
                    placeholder="xxxx-xxxx-xxxx"
                    autocomplete="off"
                    @keydown.enter="unlockRecovery"
                />
                <button @click="unlockRecovery" :disabled="busy || !recoveryCode">
                    {{ busy ? 'Tekshirilmoqda…' : 'Kirish' }}
                </button>
                <p v-if="error" class="error">{{ error }}</p>
                <button class="secondary" @click="mode = 'totp'">Orqaga</button>
            </section>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api.js';
import {
    isWebAuthnSupported,
    prepareGetOptions,
    serializeAssertion,
} from '../webauthn.js';

const router = useRouter();

const webauthnAvailable = isWebAuthnSupported();
const mode = ref(webauthnAvailable ? 'webauthn' : 'totp');
const busy = ref(false);
const error = ref('');

const code = ref('');
const recoveryCode = ref('');

onMounted(async () => {
    // If the user has no WebAuthn credentials registered, fall back to TOTP.
    try {
        const { data } = await api.post('/mfa/status');
        if (!data.enrolled) {
            router.replace('/mfa/setup');
            return;
        }
        if (data.active) {
            // Already unlocked — bounce home.
            const next = router.currentRoute.value.query.next || '/';
            router.replace(next);
            return;
        }
        if (!data.devices || data.devices === 0) {
            mode.value = 'totp';
        }
    } catch (e) {
        // status returns 200 on success; if it 403'd we'd already have
        // been redirected. Ignore non-fatal errors here.
    }
});

async function unlockWebAuthn() {
    error.value = '';
    busy.value = true;
    try {
        const { data: begin } = await api.post('/mfa/webauthn/login/begin');
        const opts = prepareGetOptions(begin.options);
        const cred = await navigator.credentials.get({ publicKey: opts });
        if (!cred) throw new Error('Bekor qilindi');
        await api.post('/mfa/webauthn/login/finish', {
            handle: begin.handle,
            body: serializeAssertion(cred),
        });
        success();
    } catch (e) {
        error.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function unlockTotp() {
    error.value = '';
    if (!/^\d{6}$/.test(code.value)) {
        error.value = 'Kod 6 raqamdan iborat bo\'lishi kerak';
        return;
    }
    busy.value = true;
    try {
        await api.post('/mfa/totp/verify', { code: code.value });
        success();
    } catch (e) {
        error.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

async function unlockRecovery() {
    error.value = '';
    if (!recoveryCode.value.trim()) {
        error.value = 'Kod kiriting';
        return;
    }
    busy.value = true;
    try {
        await api.post('/mfa/recovery/use', { code: recoveryCode.value });
        success();
    } catch (e) {
        error.value = formatError(e);
    } finally {
        busy.value = false;
    }
}

function success() {
    const next = router.currentRoute.value.query.next || '/';
    router.replace(next);
}

function formatError(e) {
    if (e.response && e.response.data) {
        if (typeof e.response.data === 'string') return e.response.data;
        if (e.response.data.error) return e.response.data.error;
    }
    return e.message || 'Tasdiqlash o\'tmadi';
}
</script>

<style scoped>
.mfa-page {
    min-height: 100vh;
    background: #1e1e1e;
    color: #e7e9ea;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 60px 20px;
}
.card {
    background: #2d2d2d;
    border-radius: 12px;
    padding: 28px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}
h1 {
    margin: 0 0 4px;
    font-size: 1.5rem;
}
.sub {
    color: #aaa;
    margin: 0 0 22px;
    font-size: 0.95rem;
}
.hint {
    color: #aaa;
    font-size: 0.9rem;
    margin: 4px 0 12px;
}
input {
    width: 100%;
    box-sizing: border-box;
    background: #1e1e1e;
    color: inherit;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    font-size: 1.2rem;
    letter-spacing: 3px;
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
    margin-top: 4px;
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
</style>
