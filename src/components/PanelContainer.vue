<template>
    <div class="panel-container">
        <div class="panel-header">
            <div class="panel-title">
                <span class="panel-type-icon">{{ panel.type === 'terminal' ? '💻' : '📂' }}</span>
                <span class="server-name">{{ panel.serverName }}</span>
            </div>
            <div class="panel-controls">
                <button @click="$emit('close', panel.id)" class="close-btn">×</button>
            </div>
        </div>
        <div class="panel-content">
            <TerminalView v-if="panel.type === 'terminal'" :serverId="panel.serverId" :serverName="panel.serverName"
                :isComponent="true" />
            <FilePane v-else-if="panel.type === 'sftp'" :serverId="panel.serverId" :initialPath="panel.path"
                paneId="single" @open-file="handleOpenFile" @download-file="handleDownloadFile"
                @download-zip="handleDownloadZip" @drop-file="handleDropFile" />
        </div>
    </div>
</template>

<script setup>
import TerminalView from '../views/TerminalView.vue';
import FilePane from './FilePane.vue';

const props = defineProps({
    panel: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['close', 'open-file', 'download-file', 'download-zip', 'drop-file']);

const handleOpenFile = (name, path, size) => emit('open-file', { ...props.panel, name, path, size });
const handleDownloadFile = (name, path, cb) => emit('download-file', { ...props.panel, name, path, cb });
const handleDownloadZip = (name, path, cb) => emit('download-zip', { ...props.panel, name, path, cb });
const handleDropFile = (data) => emit('drop-file', { ...data, targetPanelId: props.panel.id });

</script>

<style scoped>
.panel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    min-height: 40px;
}

.panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    min-width: 0;
}

.panel-type-icon { flex-shrink: 0; }

.server-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.panel-controls {
    flex-shrink: 0;
}

.close-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 20px;
    line-height: 1;
    transition: background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
}

.close-btn:hover {
    background: var(--danger-soft);
    color: var(--danger-hover);
}

.panel-content {
    flex-grow: 1;
    overflow: hidden;
    position: relative;
    min-height: 0;
}

@media (max-width: 768px) {
    .panel-container { border-radius: 0; border-left: none; border-right: none; }
    .close-btn { width: 36px; height: 36px; }
}
</style>
