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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.modal-content {
    background: #262626;
    padding: 2rem;
    border-radius: 12px;
    width: 400px;
    border: 1px solid #404040;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

h3 {
    margin-top: 0;
    color: #fff;
    margin-bottom: 1rem;
}

p {
    color: #d4d4d4;
    margin-bottom: 0.5rem;
}

.destination-text {
    font-size: 0.9rem;
    color: #a3a3a3;
    margin-bottom: 1.5rem;
    font-family: monospace;
    background: rgba(0, 0, 0, 0.2);
    padding: 0.5rem;
    border-radius: 4px;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}

.btn-primary {
    background: #fff;
    color: #000;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
}

.btn-primary:hover {
    background: #e5e5e5;
}

.btn-secondary {
    background: transparent;
    color: #d4d4d4;
    border: 1px solid #525252;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
}

.btn-secondary:hover {
    border-color: #d4d4d4;
    color: #fff;
}
</style>
