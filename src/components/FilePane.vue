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
                <button @click="createDirectory" class="btn-secondary small" :disabled="isLoading">+</button>
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
                        @click="file.is_dir ? navigate(currentPath + '/' + file.name) : $emit('open-file', file.name, currentPath)"
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
const dragOverId = ref(null);
let socket = null;

const connectWebSocket = () => {
    const token = authStore.token;
    const backendUrl = import.meta.env.VITE_API_BASE_URL;
    const protocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const backendHost = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}://${backendHost}/ws/sftp?server_id=${props.serverId}&token=${token}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        navigate(currentPath.value);
    };

    socket.onmessage = (event) => {
        isLoading.value = false;
        const msg = JSON.parse(event.data);
        if (msg.error) {
            alert('Error: ' + msg.error);
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
    if (socket) socket.close();
});

defineExpose({ refresh });
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
</style>
