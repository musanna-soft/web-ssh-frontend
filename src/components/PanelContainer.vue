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

const handleOpenFile = (name, path) => emit('open-file', { ...props.panel, name, path });
const handleDownloadFile = (name, path, cb) => emit('download-file', { ...props.panel, name, path, cb });
const handleDownloadZip = (name, path, cb) => emit('download-zip', { ...props.panel, name, path, cb });
const handleDropFile = (data) => emit('drop-file', { ...data, targetPanelId: props.panel.id });

</script>

<style scoped>
.panel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 8px;
    overflow: hidden;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
}

.panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    font-size: 0.9rem;
    font-weight: 600;
}

.close-btn {
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
}

.close-btn:hover {
    color: #ff4444;
}

.panel-content {
    flex-grow: 1;
    overflow: hidden;
    position: relative;
}
</style>
