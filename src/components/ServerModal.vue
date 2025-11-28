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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: #2d2d2d;
    padding: 2rem;
    border-radius: 8px;
    width: 400px;
    max-width: 90%;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

h2 {
    margin-top: 0;
    margin-bottom: 1.5rem;
}

.form-group {
    margin-bottom: 1rem;
}

.form-row {
    display: flex;
    gap: 1rem;
}

.small {
    width: 80px;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    color: #ccc;
}

input,
select,
textarea {
    width: 100%;
    padding: 0.5rem;
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 4px;
    color: #fff;
    font-family: inherit;
    box-sizing: border-box;
    /* Ensure padding doesn't affect width */
}

input:focus,
select:focus,
textarea:focus {
    outline: none;
    border-color: #007bff;
}

.password-field {
    position: relative;
    display: flex;
    align-items: center;
}

.toggle-password {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    color: #ccc;
}

.checkbox-group {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 1.5rem;
}

.checkbox-group input {
    width: auto;
    margin-top: 3px;
}

.checkbox-group label {
    margin-bottom: 0;
    font-size: 0.85rem;
    line-height: 1.4;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
}

.btn-primary {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
}

.btn-primary:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.7;
}

.btn-secondary {
    background: transparent;
    color: #ccc;
    border: 1px solid #444;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
}
</style>
