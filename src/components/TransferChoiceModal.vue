<template>
    <div v-if="isOpen" class="modal-overlay">
        <div class="modal-content">
            <h3>Transfer Action</h3>
            <p>What would you like to do with <strong>{{ fileName }}</strong>?</p>
            <p class="destination-text">Destination: {{ destPath }}</p>

            <div class="modal-actions">
                <button @click="$emit('action', 'move')" class="btn-primary">Move</button>
                <button @click="$emit('action', 'copy')" class="btn-primary">Copy</button>
                <button @click="$emit('action', 'cancel')" class="btn-secondary">Cancel</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    isOpen: Boolean,
    fileName: String,
    destPath: String
});

defineEmits(['action']);
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
    padding: 24px;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 420px;
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-lg);
    animation: pop-in var(--dur-base) var(--ease);
}

@keyframes fade-in { from { opacity: 0; } }
@keyframes pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
}

h3 {
    margin: 0 0 10px;
    color: var(--text-primary);
    font-size: 18px;
    letter-spacing: -0.01em;
}

p {
    color: var(--text-secondary);
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.5;
}

p b { color: var(--text-primary); }

.destination-text {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 12px 0 20px;
    font-family: var(--font-mono);
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    word-break: break-all;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-primary,
.btn-secondary {
    min-height: var(--tap-target);
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease);
}

.btn-primary {
    background: var(--accent);
    color: #fff;
    border: none;
}

.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { transform: translateY(1px); }

.btn-secondary {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    font-weight: 500;
}

.btn-secondary:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-strong);
}

/* ── Phones: bottom-sheet ───────────────────────────────── */
@media (max-width: 480px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }
    .modal-content {
        max-width: 100%;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        padding: 20px 18px 24px;
        padding-bottom: max(24px, env(safe-area-inset-bottom));
        animation: slide-up var(--dur-base) var(--ease);
    }
    @keyframes slide-up {
        from { transform: translateY(20px); opacity: 0; }
    }
    .modal-actions { flex-direction: column-reverse; }
    .btn-primary, .btn-secondary { width: 100%; }
}
</style>
