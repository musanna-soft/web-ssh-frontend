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
    border: 1px solid var(--border-subtle);
    background: var(--bg-app);
    position: relative;
    min-width: 0;
}

.pane-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    flex-wrap: wrap;
}

.path-nav {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    gap: 6px;
}

.path-input {
    flex: 1 1 auto;
    min-width: 0;
    background: var(--bg-app);
    border: 1px solid var(--border-default);
    color: var(--text-primary);
    font-size: 13px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    transition: border-color var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
}

.path-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
}

.pane-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.btn-primary,
.btn-secondary {
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
}

.btn-primary {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-weight: 600;
}

.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    font-weight: 500;
}

.btn-secondary:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-strong);
    color: var(--text-primary);
}

.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.small {
    min-width: 36px;
    min-height: 36px;
    padding: 8px 10px;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.file-list-container {
    flex-grow: 1;
    overflow-y: auto;
    position: relative;
    -webkit-overflow-scrolling: touch;
}

.loader-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 17, 21, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: grid;
    place-items: center;
    z-index: 10;
}

.spinner {
    border: 3px solid var(--border-default);
    border-top-color: var(--accent);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    animation: spin 0.8s linear infinite;
}

.spinner-small {
    display: inline-block;
    border: 2px solid var(--border-default);
    border-top-color: var(--accent);
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.file-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    color: var(--text-primary);
}

.file-table thead th {
    text-align: left;
    padding: 10px 12px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    position: sticky;
    top: 0;
    z-index: 1;
}

.file-table tbody td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
}

.file-table tbody tr {
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease);
}

.file-table tbody tr:hover {
    background: var(--bg-surface-2);
}

.folder-row { font-weight: 500; }

.drag-over {
    background: var(--accent-soft) !important;
    box-shadow: inset 0 0 0 1px var(--accent);
}

.icon {
    margin-right: 8px;
    font-size: 14px;
}

.actions-cell {
    width: 1%;
    white-space: nowrap;
    text-align: right;
}

.actions-cell .icon-btn + .icon-btn { margin-left: 4px; }

.icon-btn {
    width: 36px;
    height: 36px;
    display: inline-grid;
    place-items: center;
    background: transparent;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    font-size: 16px;
    transition: background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
}

.icon-btn:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
}

.icon-btn.delete:hover {
    background: var(--danger-soft);
    color: var(--danger-hover);
}

.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Tablets ─────────────────────────────────────────────── */
@media (max-width: 768px) {
    .pane-header { padding: 8px; gap: 6px; }
    .path-nav { flex-basis: 100%; }
    .pane-actions { flex-basis: 100%; justify-content: flex-start; flex-wrap: wrap; }
}

/* ── Phones: table → cards ──────────────────────────────── */
@media (max-width: 480px) {
    .file-table thead { display: none; }

    .file-table tbody tr {
        display: grid;
        grid-template-columns: 1fr auto;
        column-gap: 8px;
        row-gap: 2px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-subtle);
        align-items: center;
    }

    .file-table tbody tr:hover { background: var(--bg-surface-2); }

    .file-table tbody td {
        padding: 0;
        border: none;
    }

    /* Name column: row 1, col 1 */
    .file-table tbody td:nth-child(1) {
        grid-row: 1;
        grid-column: 1;
        font-size: 15px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Size column: row 2, col 1 — under the name as metadata */
    .file-table tbody td:nth-child(2) {
        grid-row: 2;
        grid-column: 1;
        font-size: 12px;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
    }

    /* Actions: row 1-2, col 2 */
    .file-table tbody td.actions-cell {
        grid-row: 1 / span 2;
        grid-column: 2;
        text-align: right;
    }

    /* The ".." row uses colspan=3 — keep it simple as a single cell. */
    .file-table tbody tr.folder-row td[colspan] {
        grid-column: 1 / -1;
        grid-row: 1;
        padding: 6px 0;
    }

    .icon-btn { width: 40px; height: 40px; font-size: 18px; }
}
</style>
