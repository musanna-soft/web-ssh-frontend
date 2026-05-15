<template>
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-content">
            <h2>{{ isEdit ? 'Edit Server' : 'Add Server' }}</h2>
            <form @submit.prevent="handleSubmit">
                <div class="form-group">
                    <label>Folder</label>
                    <select v-model="form.folder_id">
                        <option :value="null">None</option>
                        <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                            {{ folder.name }}
                        </option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input v-model="form.name" required placeholder="My Server" />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Host</label>
                        <input v-model="form.host" required placeholder="192.168.1.1" />
                    </div>
                    <div class="form-group small">
                        <label>Port</label>
                        <input v-model.number="form.port" type="number" required placeholder="22" />
                    </div>
                </div>
                <div class="form-group">
                    <label>Username</label>
                    <input v-model="form.username" required placeholder="root" />
                </div>
                <div class="form-group">
                    <label>Auth Type</label>
                    <select v-model="form.auth_type">
                        <option value="password">Password</option>
                        <option value="key">Private Key</option>
                    </select>
                </div>

                <!-- Edit Mode: Checkbox to enable password change -->
                <div class="form-group checkbox-group" v-if="isEdit">
                    <input type="checkbox" id="changePassword" v-model="changePassword" />
                    <label for="changePassword">Change Password / Key</label>
                </div>

                <div class="form-group" v-if="!isEdit || changePassword">
                    <label>{{ form.auth_type === 'password' ? 'Password' : 'Private Key' }}</label>
                    <div class="password-input-wrapper">
                        <textarea v-if="form.auth_type === 'key'" v-model="form.secret" required
                            placeholder="-----BEGIN RSA PRIVATE KEY-----" rows="4"></textarea>
                        <div v-else class="password-field">
                            <input v-model="form.secret" :type="showPassword ? 'text' : 'password'" required
                                placeholder="SecretPassword" />
                            <button type="button" class="toggle-password" @click="showPassword = !showPassword">
                                {{ showPassword ? '🙈' : '👁️' }}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="form-group checkbox-group" v-if="(!isEdit || changePassword) && form.secret">
                    <input type="checkbox" id="consent" v-model="consent" required />
                    <label for="consent">
                        I agree to store my password/key in an encrypted format.
                    </label>
                </div>

                <div class="modal-actions">
                    <button type="button" @click="close" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary"
                        :disabled="(!isEdit || changePassword) && form.secret && !consent">Save</button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    isOpen: Boolean,
    server: Object,
    folders: Array,
});

const emit = defineEmits(['close', 'save']);

const isEdit = ref(false);
const showPassword = ref(false);
const consent = ref(false);
const changePassword = ref(false);

const form = ref({
    name: '',
    host: '',
    port: 22,
    username: '',
    auth_type: 'password',
    secret: '',
    folder_id: null,
});

const close = () => {
    emit('close');
};

const handleEsc = (e) => {
    if (props.isOpen && e.key === 'Escape') {
        close();
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleEsc);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleEsc);
});

watch(() => props.server, (newServer) => {
    if (newServer) {
        isEdit.value = true;
        form.value = { ...newServer, secret: '' }; // Don't show secret
        consent.value = false;
        changePassword.value = false; // Reset change password
    } else {
        isEdit.value = false;
        form.value = {
            name: '',
            host: '',
            port: 22,
            username: '',
            auth_type: 'password',
            secret: '',
            folder_id: null,
        };
        consent.value = false;
        changePassword.value = false;
    }
    showPassword.value = false;
}, { immediate: true });

const handleSubmit = () => {
    if ((!isEdit.value || changePassword.value) && form.value.secret && !consent.value) return;

    // If editing and NOT changing password, ensure secret is empty so backend ignores it
    if (isEdit.value && !changePassword.value) {
        form.value.secret = '';
    }

    emit('save', { ...form.value, id: props.server?.id });
};
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay-strong);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: var(--z-modal);
    padding: 24px;
    animation: fade-in var(--dur-base) var(--ease);
}

.modal-content {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    padding: 24px;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-lg);
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    animation: pop-in var(--dur-base) var(--ease);
}

@keyframes fade-in { from { opacity: 0; } }
@keyframes pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
}

h2 {
    margin: 0 0 20px;
    font-size: 18px;
    letter-spacing: -0.01em;
}

.form-group {
    margin-bottom: 14px;
}

.form-row {
    display: flex;
    gap: 12px;
}

.form-row > .form-group { flex: 1 1 auto; }
.form-row > .form-group.small { flex: 0 0 96px; }

label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
}

input,
select,
textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-app);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 15px;
    transition: border-color var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
}

textarea {
    min-height: 96px;
    resize: vertical;
    font-family: var(--font-mono);
    font-size: 13px;
}

input:focus,
select:focus,
textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
}

.password-field {
    position: relative;
    display: flex;
    align-items: center;
}

.password-field input { padding-right: 44px; }

.toggle-password {
    position: absolute;
    right: 8px;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 16px;
    color: var(--text-secondary);
}

.toggle-password:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
}

.checkbox-group {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 18px;
    padding: 12px;
    background: var(--bg-surface-2);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
}

.checkbox-group input[type="checkbox"] {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    margin: 1px 0 0;
    accent-color: var(--accent);
    cursor: pointer;
}

.checkbox-group label {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
    cursor: pointer;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 22px;
}

.btn-primary {
    min-height: var(--tap-target);
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
}

.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { transform: translateY(1px); }

.btn-primary:disabled {
    background: var(--bg-surface-3);
    color: var(--text-tertiary);
    cursor: not-allowed;
    transform: none;
}

.btn-secondary {
    min-height: var(--tap-target);
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    padding: 10px 18px;
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 14px;
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease);
}

.btn-secondary:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-strong);
}

/* ── Tablets ─────────────────────────────────────────────── */
@media (max-width: 768px) {
    .form-row { flex-direction: column; gap: 14px; }
    .form-row > .form-group.small { flex: 1 1 auto; }
    .modal-actions { flex-direction: column-reverse; }
    .btn-primary, .btn-secondary { width: 100%; }
}

/* ── Phones: bottom-sheet style ──────────────────────────── */
@media (max-width: 480px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }
    .modal-content {
        max-width: 100%;
        max-height: 92dvh;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        padding: 20px 18px 24px;
        padding-bottom: max(24px, env(safe-area-inset-bottom));
        animation: slide-up var(--dur-base) var(--ease);
    }
    @keyframes slide-up {
        from { transform: translateY(20px); opacity: 0; }
    }
    h2 { font-size: 17px; margin-bottom: 16px; }
}
</style>
