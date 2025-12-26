<template>
    <div class="file-pane" @dragover.prevent @drop="handleDrop">
        <div class="pane-header">
            <div class="path-nav">
                <input v-model="currentPath" @keyup.enter="navigate(currentPath)" class="path-input"
                    :disabled="isLoading" />
                <button @click="navigate(currentPath)" class="btn-primary small" :disabled="isLoading">Go</button>
            </div>
            <div class="pane-actions">
                <button @click="navigate('..')" class="btn-secondary small"
                    :disabled="currentPath === '/' || isLoading">⬆</button>
                <button @click="refresh" class="btn-secondary small" :disabled="isLoading">↻</button>
                <button @click="triggerUploadPicker" class="btn-secondary small" title="Upload"
                    :disabled="isLoading || isUploading">📤</button>
                <button @click="createDirectory" class="btn-secondary small" :disabled="isLoading">+</button>
                <input ref="uploadInput" type="file" multiple hidden @change="handleUploadPicked"
                    :disabled="isLoading || isUploading" />
            </div>
        </div>

        <div class="file-list-container" :class="{ 'loading': isLoading }">
            <div v-if="isLoading" class="loader-overlay">
                <div class="spinner"></div>
            </div>
            <table class="file-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="currentPath !== '/'" @click="navigate('..')" class="folder-row" @dragover.prevent
                        @drop.stop="handleDrop($event, '..')">
                        <td colspan="3">..</td>
                    </tr>
                    <tr v-for="file in files" :key="file.name"
                        :class="{ 'folder-row': file.is_dir, 'drag-over': dragOverId === file.name }"
                        @click="file.is_dir ? navigate(currentPath + '/' + file.name) : $emit('open-file', file.name, currentPath, file.size)"
                        draggable="true" @dragstart="handleDragStart(file, $event)"
                        @dragenter="file.is_dir ? dragOverId = file.name : null"
                        @dragleave="file.is_dir && dragOverId === file.name ? dragOverId = null : null"
                        @dragover.prevent @drop.stop="file.is_dir ? handleDrop($event, file.name) : null">
                        <td>
                            <span class="icon">{{ file.is_dir ? '📁' : '📄' }}</span>
                            {{ file.name }}
                        </td>
                        <td>{{ formatSize(file.size) }}</td>
                        <td class="actions-cell">
                            <button v-if="!file.is_dir" @click.stop="handleDownload(file.name)" class="icon-btn"
                                title="Download" :disabled="loadingFiles.has(file.name)">
                                <span v-if="loadingFiles.has(file.name)" class="spinner-small"></span>
                                <span v-else>⬇️</span>
                            </button>
                            <button v-if="file.is_dir" @click.stop="handleDownloadZip(file.name)" class="icon-btn"
                                title="Download Zip" :disabled="loadingFiles.has(file.name)">
                                <span v-if="loadingFiles.has(file.name)" class="spinner-small"></span>
                                <span v-else>📦</span>
                            </button>
                            <button @click.stop="deleteFile(file.name)" class="icon-btn delete" title="Delete"
                                :disabled="isLoading">🗑</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
    serverId: String,
    initialPath: String,
    paneId: String, // 'left' or 'right'
});

const emit = defineEmits(['open-file', 'download-file', 'download-zip', 'drag-start', 'drop-file']);

const authStore = useAuthStore();
const currentPath = ref(props.initialPath || '.');
const files = ref([]);
const isLoading = ref(false); // General loading (ls, mkdir)
const loadingFiles = ref(new Set()); // Per-file loading (download)
const isUploading = ref(false);
const dragOverId = ref(null);
let socket = null;

const uploadInput = ref(null);

const triggerUploadPicker = () => {
    if (isLoading.value || isUploading.value) return;
    uploadInput.value?.click?.();
};

const handleUploadPicked = async (event) => {
    const input = event?.target;
    const picked = input?.files;
    if (!picked || picked.length === 0) return;

    await uploadFiles(picked);

    // Allow re-selecting the same file(s)
    if (input) input.value = '';
};

let isUnmounting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let reconnectTimeout = null;
let pingInterval = null;

const startPingInterval = () => {
    stopPingInterval();
    pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'ping' }));
        }
    }, 30000);
};

const stopPingInterval = () => {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
};

const cleanup = () => {
    stopPingInterval();
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
};

const attemptReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
        console.warn('Max SFTP reconnection attempts reached');
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);

    reconnectTimeout = setTimeout(() => {
        connectWebSocket();
    }, delay);
};

const uploadFiles = async (fileList, destinationPath = null) => {
    const list = Array.from(fileList || []).filter(f => f && typeof f.name === 'string');
    if (list.length === 0) return;

    const dest = (destinationPath ?? currentPath.value);
    const destPath = (dest && dest !== '.') ? dest : '/';

    const token = authStore.token || localStorage.getItem('jwt_token');
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/sftp/upload`;

    isUploading.value = true;
    try {
        for (const f of list) {
            loadingFiles.value.add(f.name);
            const form = new FormData();
            form.append('server_id', String(props.serverId));
            form.append('path', destPath);
            form.append('file', f, f.name);

            const res = await fetch(url, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: form,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Upload failed (HTTP ${res.status})`);
            }

            loadingFiles.value.delete(f.name);
        }
        refresh();
    } catch (e) {
        const message = (e && e.message) ? e.message : String(e);
        alert('Upload error: ' + message);
    } finally {
        // best-effort cleanup
        for (const f of list) loadingFiles.value.delete(f.name);
        isUploading.value = false;
    }
};

const connectWebSocket = () => {
    // Close any existing socket before reconnecting
    if (socket) {
        try {
            socket.close(1000, 'Reconnecting');
        } catch (e) {
            // ignore
        }
        socket = null;
    }

    const token = authStore.token || localStorage.getItem('jwt_token');
    const backendUrl = import.meta.env.VITE_API_BASE_URL;
    const protocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const backendHost = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}://${backendHost}/ws/sftp?server_id=${props.serverId}&token=${token}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        reconnectAttempts = 0;
        startPingInterval();
        navigate(currentPath.value);
    };

    socket.onmessage = (event) => {
        isLoading.value = false;
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }
        if (msg.error) {
            alert('Error: ' + msg.error);
        } else if (msg.action === 'pong') {
            return;
        } else if (msg.action === 'ls') {
            currentPath.value = msg.path;
            files.value = msg.files.sort((a, b) => {
                if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                return a.is_dir ? -1 : 1;
            });
        } else if (msg.action === 'mkdir' || msg.action === 'rm') {
            refresh();
        }
    };

    socket.onclose = (event) => {
        stopPingInterval();
        isLoading.value = false;

        if (isUnmounting) {
            return;
        }

        // Unexpected close => reconnect
        if (event.code !== 1000) {
            attemptReconnect();
        }
    };

    socket.onerror = (error) => {
        console.error('SFTP WebSocket error:', error);
    };
};

const navigate = (path) => {
    isLoading.value = true;
    let newPath = path;
    if (path === '..') {
        const parts = currentPath.value.split('/').filter(p => p);
        parts.pop();
        newPath = '/' + parts.join('/');
    } else if (!path.startsWith('/')) {
        newPath = (currentPath.value === '/' ? '' : currentPath.value) + '/' + path;
    }
    newPath = newPath.replace(/\/+/g, '/');
    if (newPath === '') newPath = '/';

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'ls', path: newPath }));
    } else {
        isLoading.value = false;
    }
};

const refresh = () => {
    navigate(currentPath.value);
};

const createDirectory = () => {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const path = (currentPath.value === '/' ? '' : currentPath.value) + '/' + name;
    socket.send(JSON.stringify({ action: 'mkdir', path }));
};

const deleteFile = (name) => {
    if (!confirm(`Delete ${name}?`)) return;
    const path = (currentPath.value === '/' ? '' : currentPath.value) + '/' + name;
    socket.send(JSON.stringify({ action: 'rm', path }));
};

const handleDownload = (name) => {
    loadingFiles.value.add(name);
    emit('download-file', name, currentPath.value, () => {
        loadingFiles.value.delete(name);
    });
};

const handleDownloadZip = (name) => {
    loadingFiles.value.add(name);
    emit('download-zip', name, currentPath.value, () => {
        loadingFiles.value.delete(name);
    });
};

const handleDragStart = (file, event) => {
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('fileName', file.name);
    event.dataTransfer.setData('sourcePath', currentPath.value);
    event.dataTransfer.setData('sourcePane', props.paneId);
    event.dataTransfer.setData('sourceServerId', props.serverId);
};

const handleDrop = (event, targetFolder = null) => {
    dragOverId.value = null;

    // Local file(s) drop => upload into current/target folder
    const droppedFiles = event?.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
        // Calculate destination path
        let destPath = currentPath.value;
        if (targetFolder) {
            if (targetFolder === '..') {
                const parts = currentPath.value.split('/').filter(p => p);
                parts.pop();
                destPath = '/' + parts.join('/');
            } else {
                destPath = (currentPath.value === '/' ? '' : currentPath.value) + '/' + targetFolder;
            }
        }
        destPath = destPath.replace(/\/+$/g, '') || '/';
        uploadFiles(droppedFiles, destPath);
        return;
    }

    const fileName = event.dataTransfer.getData('fileName');
    const sourcePath = event.dataTransfer.getData('sourcePath');
    const sourcePane = event.dataTransfer.getData('sourcePane');
    const sourceServerId = event.dataTransfer.getData('sourceServerId');

    // Calculate destination path
    let destPath = currentPath.value;
    if (targetFolder) {
        if (targetFolder === '..') {
            const parts = currentPath.value.split('/').filter(p => p);
            parts.pop();
            destPath = '/' + parts.join('/');
        } else {
            destPath = (currentPath.value === '/' ? '' : currentPath.value) + '/' + targetFolder;
        }
    }

    // Same pane drop logic (if sourcePane === props.paneId)
    // Cross pane drop logic (if sourcePane !== props.paneId)

    emit('drop-file', {
        fileName,
        sourcePath,
        destPath,
        sourcePane,
        destPane: props.paneId,
        isSamePane: sourcePane === props.paneId,
        sourceServerId,
        destServerId: props.serverId
    });
};

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

onMounted(() => {
    connectWebSocket();
});

onBeforeUnmount(() => {
    isUnmounting = true;
    cleanup();
    if (socket) {
        socket.close(1000, 'Component unmounting');
    }
});

defineExpose({ refresh, uploadFiles });
</script>

<style scoped>
.file-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 1px solid #333;
    background: #1e1e1e;
    position: relative;
}

.pane-header {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #252526;
    border-bottom: 1px solid #333;
}

.path-nav {
    flex-grow: 1;
    display: flex;
    gap: 0.5rem;
}

.path-input {
    width: 100%;
    background: #1e1e1e;
    border: 1px solid #444;
    color: #fff;
    padding: 2px 5px;
}

.pane-actions {
    display: flex;
    gap: 2px;
}

.small {
    padding: 2px 6px;
    font-size: 0.8rem;
}

.file-list-container {
    flex-grow: 1;
    overflow-y: auto;
    position: relative;
}

.loader-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
}

.spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
}

.spinner-small {
    display: inline-block;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    width: 12px;
    height: 12px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.file-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
}

.file-table th,
.file-table td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid #333;
}

.folder-row {
    cursor: pointer;
}

.folder-row:hover {
    background: #2d2d2d;
}

.drag-over {
    background: #3a3a3a !important;
    border: 1px dashed #007bff;
}

/* Icon Polish - Reverted to colored */
.icon {
    margin-right: 0.5rem;
    /* filter: grayscale(100%) brightness(1.5); Removed grayscale */
}

.icon-btn {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px;
    /* filter: grayscale(100%); Removed grayscale */
    transition: all 0.2s;
}

.icon-btn:hover {
    color: #fff;
    transform: scale(1.1);
}

.icon-btn.delete:hover {
    color: #ff4444;
}

/* Responsive Styles */
@media (max-width: 768px) {
    .pane-header {
        flex-direction: column;
        gap: 0.5rem;
    }

    .path-nav {
        width: 100%;
    }

    .pane-actions {
        width: 100%;
        justify-content: space-between;
    }

    .file-table {
        font-size: 0.85rem;
    }

    .file-table th,
    .file-table td {
        padding: 6px 4px;
    }

    .actions-cell {
        white-space: nowrap;
    }
}

@media (max-width: 480px) {
    .file-table {
        font-size: 0.8rem;
    }

    .file-table th:nth-child(2),
    .file-table td:nth-child(2) {
        display: none;
    }

    .icon-btn {
        font-size: 0.9rem;
    }

    .btn-primary.small,
    .btn-secondary.small {
        padding: 0.4rem 0.6rem;
        font-size: 0.85rem;
    }
}
</style>
