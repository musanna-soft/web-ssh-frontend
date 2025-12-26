<template>
    <div class="dashboard-layout">
        <aside class="sidebar" v-if="showSidebar">
            <div class="user-info" v-if="user">
                <img :src="user.avatar_url" alt="Avatar" class="avatar" />
                <div class="user-details">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-email">{{ user.email }}</span>
                </div>
            </div>
            <div class="folder-list">
                <div class="folder-item" :class="{ active: !selectedFolder, 'drag-hover': dragOverFolderId === 'all' }"
                    @click="selectFolder(null)" @dragover.prevent @dragenter="dragOverFolderId = 'all'"
                    @dragleave="dragOverFolderId === 'all' ? dragOverFolderId = null : null"
                    @drop="handleDrop($event, null)" title="All Servers">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">All Servers</span>
                </div>
                <div v-for="folder in folders" :key="folder.id" class="folder-item"
                    :class="{ active: selectedFolder === folder.id, 'drag-hover': dragOverFolderId === folder.id }"
                    @click="selectFolder(folder.id)" @dragover.prevent @dragenter="dragOverFolderId = folder.id"
                    @dragleave="dragOverFolderId === folder.id ? dragOverFolderId = null : null"
                    @drop="handleDrop($event, folder.id)" :title="folder.name">
                    <span class="folder-icon">📂</span>
                    <span class="folder-name">{{ folder.name }}</span>
                    <button class="delete-folder-btn" @click.stop="deleteFolder(folder.id)">×</button>
                </div>
            </div>

            <button class="add-folder-btn" @click="createFolder">
                <span>+ New Folder</span>
            </button>

            <div class="sidebar-footer">
                <button @click="logout" class="btn-secondary logout-btn">
                    <span>Logout</span>
                </button>
            </div>
        </aside>

        <main class="dashboard-content" :class="{ 'workspace-mode': panelStore.panels.length > 0 }">
            <header v-if="panelStore.panels.length === 0">
                <div class="header-title">
                    <h2>{{ currentFolderName }}</h2>
                </div>
                <div class="actions">
                    <button @click="openModal" class="btn-primary">+ Add Server</button>
                </div>
            </header>

            <div class="servers-section" v-if="panelStore.panels.length === 0">
                <div class="servers-grid">
                    <div v-for="server in filteredServers" :key="server.id" class="server-card" draggable="true"
                        @dragstart="handleDragStart(server, $event)">
                        <div class="card-header">
                            <h3>{{ server.name }}</h3>
                            <div class="card-actions">
                                <button @click="editServer(server)" class="icon-btn" title="Edit">✎</button>
                                <button @click="deleteServer(server.id)" class="icon-btn delete"
                                    title="Delete">🗑</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <p><strong>Host:</strong> {{ server.host }}</p>
                            <p><strong>User:</strong> {{ server.username }}</p>
                        </div>
                        <div class="card-footer">
                            <button @click="addPanel('terminal', server.id, server.name, server.username)"
                                class="btn-connect">Terminal</button>
                            <button @click="addPanel('sftp', server.id, server.name, server.username)" class="btn-files"
                                title="File Manager">📂</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Active Panels Grid -->
            <div class="panels-grid" v-else>
                <div class="servers-mini-bar">
                    <button @click="panelStore.panels = []; showSidebar = true;" class="btn-secondary back-to-servers">←
                        Servers</button>
                    <div class="mini-server-list">
                        <div v-for="server in filteredServers" :key="server.id" class="mini-server-item">
                            <span>{{ server.name }}</span>
                            <button @click="addPanel('terminal', server.id, server.name, server.username)"
                                title="Terminal">💻</button>
                            <button @click="addPanel('sftp', server.id, server.name, server.username)"
                                title="SFTP">📂</button>
                        </div>
                    </div>
                </div>

                <div class="panels-container" ref="panelsContainer">
                    <template v-for="(panel, index) in panelStore.panels" :key="panel.id">
                        <PanelContainer :panel="panel" @close="removePanel" @open-file="handleOpenFile"
                            @download-file="handleDownloadFile" @download-zip="handleDownloadZip"
                            @drop-file="handleCrossPaneDrop" class="panel-wrapper"
                            :style="{ flex: `0 0 ${panelSizes[index]}%` }" />
                        <div v-if="index < panelStore.panels.length - 1" class="panel-resizer"
                            @mousedown="startResize(index, $event)"></div>
                    </template>
                </div>
            </div>
        </main>
    </div>

    <ServerModal :isOpen="isModalOpen" :server="editingServer" :folders="folders" @close="closeModal"
        @save="saveServer" />

    <!-- Editor Modal (Global for all panels) -->
    <div v-if="editorOpen" class="modal-overlay">
        <div class="modal-content editor-modal">
            <h2>Edit File: {{ editingFile }}</h2>
            <textarea v-model="fileContent" class="editor-textarea"></textarea>
            <div class="modal-actions">
                <button @click="closeEditor" class="btn-secondary">Cancel</button>
                <button @click="saveFile" class="btn-primary">Save</button>
            </div>
        </div>
    </div>

    <!-- Image Viewer Modal (Global for all panels) -->
    <div v-if="imageViewerOpen" class="modal-overlay" @click.self="closeImageViewer">
        <div class="modal-content image-modal">
            <div class="image-header">
                <h2>{{ editingFile }}</h2>
                <button @click="closeImageViewer" class="icon-btn-close">×</button>
            </div>
            <div class="image-container">
                <img :src="imageSrc" alt="Preview" />
            </div>
        </div>
    </div>

    <TransferChoiceModal :isOpen="showTransferModal" :fileName="transferData?.fileName || ''"
        :destPath="transferData?.destPath || ''" @action="handleTransferAction" />
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { usePanelStore } from '../stores/panels';
import ServerModal from '../components/ServerModal.vue';
import PanelContainer from '../components/PanelContainer.vue';
import TransferChoiceModal from '../components/TransferChoiceModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const panelStore = usePanelStore();
const user = computed(() => authStore.user);

const servers = ref([]);
const folders = ref([]);
const selectedFolder = ref(null);
const isModalOpen = ref(false);
const editingServer = ref(null);
const dragOverFolderId = ref(null);
const showSidebar = ref(true);

// Editor State (Global)
const editorOpen = ref(false);
const editingFile = ref('');
const fileContent = ref('');
const editingPath = ref('');
const editingServerId = ref(null);

// Image Viewer State (Global)
const imageViewerOpen = ref(false);
const imageSrc = ref('');

// Transfer Modal State
const showTransferModal = ref(false);
const transferData = ref(null);

// Panel Resizing State
const panelsContainer = ref(null);
const panelSizes = ref([]);
const isResizing = ref(false);
const currentResizeIndex = ref(-1);

const startResize = (index, event) => {
    isResizing.value = true;
    currentResizeIndex.value = index;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
};

const handleResize = (event) => {
    if (!isResizing.value || !panelsContainer.value) return;

    const containerRect = panelsContainer.value.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = event.clientX - containerRect.left;

    // Convert mouse position to percentage
    const mousePercent = (mouseX / containerWidth) * 100;

    // Calculate cumulative width of panels BEFORE the one being resized
    let previousWidth = 0;
    for (let i = 0; i < currentResizeIndex.value; i++) {
        previousWidth += panelSizes.value[i];
    }

    // New width for panel[index]
    let newWidth = mousePercent - previousWidth;

    // Min width constraint (e.g., 10%)
    if (newWidth < 10) newWidth = 10;

    // The next panel (index+1) must also have min width.
    const nextPanelIndex = currentResizeIndex.value + 1;
    const combinedWidth = panelSizes.value[currentResizeIndex.value] + panelSizes.value[nextPanelIndex];

    if (newWidth > combinedWidth - 10) newWidth = combinedWidth - 10;

    const newNextWidth = combinedWidth - newWidth;

    panelSizes.value[currentResizeIndex.value] = newWidth;
    panelSizes.value[nextPanelIndex] = newNextWidth;
};

const stopResize = () => {
    isResizing.value = false;
    currentResizeIndex.value = -1;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
};

const fetchServers = async () => {
    try {
        const res = await api.get('/servers');
        servers.value = res.data;
    } catch (err) {
        console.error(err);
    }
};

const fetchFolders = async () => {
    try {
        const res = await api.get('/folders');
        folders.value = res.data;
    } catch (err) {
        console.error(err);
    }
};

const fetchUser = async () => {
    try {
        const res = await api.get('/me');
        authStore.user = res.data;
    } catch (err) {
        console.error(err);
    }
};

const currentFolderName = computed(() => {
    if (selectedFolder.value === null) return 'All Servers';
    const folder = folders.value.find(f => f.id === selectedFolder.value);
    return folder ? folder.name : 'Unknown Folder';
});

// Watch panels to reset sizes and auto-collapse sidebar
watch(() => panelStore.panels, (newPanels, oldPanels) => {
    // Auto-collapse sidebar when entering workspace mode (first panel added)
    if (newPanels.length > 0 && (!oldPanels || oldPanels.length === 0)) {
        showSidebar.value = false;
    }

    if (newPanels.length === 0) {
        panelSizes.value = [];
        return;
    }
    // If length changed, reset to equal distribution
    if (panelSizes.value.length !== newPanels.length) {
        const width = 100 / newPanels.length;
        panelSizes.value = newPanels.map(() => width);
    }
}, { deep: true, immediate: true });

const filteredServers = computed(() => {
    if (selectedFolder.value === null) return servers.value;
    return servers.value.filter(s => s.folder_id === selectedFolder.value);
});

const selectFolder = (id) => {
    selectedFolder.value = id;
};

const createFolder = async () => {
    const name = prompt("Folder Name:");
    if (!name) return;
    try {
        await api.post('/folders', { name });
        fetchFolders();
    } catch (err) {
        alert(err.message);
    }
};

const deleteFolder = async (id) => {
    if (!confirm("Delete folder? Servers will be moved to 'All Servers'.")) return;
    try {
        await api.delete(`/folders?id=${id}`);
        fetchFolders();
        fetchServers(); // Refresh servers as their folder_id might change
        if (selectedFolder.value === id) selectedFolder.value = null;
    } catch (err) {
        alert(err.message);
    }
};

const openModal = () => {
    editingServer.value = null;
    isModalOpen.value = true;
};

const editServer = (server) => {
    editingServer.value = server;
    isModalOpen.value = true;
};

const closeModal = () => {
    isModalOpen.value = false;
};

const saveServer = async (serverData) => {
    try {
        if (serverData.id) {
            await api.put(`/servers?id=${serverData.id}`, serverData);
        } else {
            await api.post('/servers', serverData);
        }
        closeModal();
        fetchServers();
    } catch (err) {
        alert(err.response?.data || err.message);
    }
};

const deleteServer = async (id) => {
    if (!confirm('Are you sure?')) return;
    try {
        await api.delete(`/servers?id=${id}`);
        fetchServers();
    } catch (err) {
        console.error(err);
    }
};

const logout = () => {
    authStore.logout();
    router.push('/login');
};

const handleDragStart = (server, event) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('serverId', server.id);
};

const handleDrop = async (event, folderId) => {
    dragOverFolderId.value = null;
    const serverId = event.dataTransfer.getData('serverId');
    if (!serverId) return;

    const server = servers.value.find(s => s.id == serverId);
    if (!server) return;

    // Optimistic update
    const originalFolderId = server.folder_id;
    server.folder_id = folderId;

    try {
        // We need to send the FULL server object to update it,
        // but we only want to change the folder_id.
        // The backend UpdateServer expects all fields.
        // Let's construct the payload.
        const payload = {
            name: server.name,
            host: server.host,
            port: server.port,
            username: server.username,
            auth_type: server.auth_type,
            folder_id: folderId,
            secret: "" // Empty secret to keep existing
        };

        await api.put(`/servers?id=${serverId}`, payload);
        // Success toast could go here
        // alert("Moved successfully"); // User requested feedback
    } catch (err) {
        server.folder_id = originalFolderId; // Revert
        alert("Failed to move server: " + err.message);
    }
};

// Panel Management
const addPanel = (type, serverId, serverName, username) => {
    showSidebar.value = false;
    panelStore.addPanel(type, serverId.toString(), serverName, username);
};

const removePanel = (id) => {
    panelStore.removePanel(id);
    if (panelStore.panels.length === 0) {
        showSidebar.value = true;
    }
};

const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    // revoke async to avoid breaking the download in some browsers
    setTimeout(() => {
        try {
            window.URL.revokeObjectURL(url);
        } catch (e) {
            // ignore
        }
    }, 0);
};

// File Operations (Global handlers)
const handleOpenFile = async ({ serverId, name, path, size }) => {
    const fullPath = (path === '/' ? '' : path) + '/' + name;
    const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2MB

    const downloadRelUrl = `/sftp/download?server_id=${serverId}&path=${encodeURIComponent(fullPath)}`;

    // Rely on WS-provided size for the memory guard.
    // If size is missing, avoid reading the file into memory and just download.
    if (!Number.isFinite(size)) {
        handleDownloadFile({ serverId, name, path });
        return;
    }

    if (size > MAX_PREVIEW_BYTES) {
        handleDownloadFile({ serverId, name, path });
        return;
    }

    try {
        const res = await api.get(downloadRelUrl, { responseType: 'blob' });
        const contentType = (res.headers?.['content-type'] || '').toLowerCase();

        if (contentType.startsWith('image/')) {
            if (imageSrc.value) {
                try {
                    window.URL.revokeObjectURL(imageSrc.value);
                } catch (e) {
                    // ignore
                }
            }
            imageSrc.value = window.URL.createObjectURL(res.data);
            editingFile.value = name;
            editingPath.value = fullPath;
            editingServerId.value = serverId;
            imageViewerOpen.value = true;
            return;
        }

        if (contentType.startsWith('text/') || contentType.includes('json')) {
            fileContent.value = await res.data.text();
            editingFile.value = name;
            editingPath.value = fullPath;
            editingServerId.value = serverId;
            editorOpen.value = true;
            return;
        }

        // Unknown/binary (but small): just download the blob we already have.
        downloadBlob(res.data, name);
    } catch (err) {
        alert('Failed to open file: ' + err.message);
        handleDownloadFile({ serverId, name, path });
    }
};

const closeEditor = () => {
    editorOpen.value = false;
    editingFile.value = '';
    fileContent.value = '';
    editingPath.value = '';
    editingServerId.value = null;
};

const closeImageViewer = () => {
    imageViewerOpen.value = false;
    if (imageSrc.value) {
        try {
            window.URL.revokeObjectURL(imageSrc.value);
        } catch (e) {
            // ignore
        }
    }
    imageSrc.value = '';
    editingFile.value = '';
    editingPath.value = '';
    editingServerId.value = null;
};

const saveFile = async () => {
    try {
        await api.post('/sftp/content', {
            server_id: parseInt(editingServerId.value),
            path: editingPath.value,
            content: fileContent.value
        });
        closeEditor();
        alert('File saved successfully');
    } catch (err) {
        alert('Failed to save file: ' + err.message);
    }
};

const handleDownloadFile = (data) => {
    // Implement download logic
    const { serverId, name, path, cb } = data;
    const fullPath = (path === '/' ? '' : path) + '/' + name;
    const url = `/sftp/download?server_id=${serverId}&path=${encodeURIComponent(fullPath)}`;

    api.get(url, { responseType: 'blob' })
        .then(response => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', name);
            document.body.appendChild(link);
            link.click();
            link.remove();
        })
        .catch(err => console.error(err))
        .finally(() => {
            if (cb) cb();
        });
};

const handleDownloadZip = (data) => {
    const { serverId, name, path, cb } = data;
    const fullPath = (path === '/' ? '' : path) + '/' + name;
    const url = `/sftp/zip?server_id=${serverId}&path=${encodeURIComponent(fullPath)}`;

    api.get(url, { responseType: 'blob' })
        .then(response => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', name + '.zip');
            document.body.appendChild(link);
            link.click();
            link.remove();
        })
        .catch(err => console.error(err))
        .finally(() => {
            if (cb) cb();
        });
};

const handleCrossPaneDrop = async (data) => {
    const { fileName, sourcePath, destPath, sourceServerId, destServerId } = data;

    if (!sourceServerId || !destServerId) {
        console.error("Missing server IDs", data);
        return;
    }

    const srcFull = (sourcePath === '/' ? '' : sourcePath) + '/' + fileName;
    const destFull = (destPath === '/' ? '' : destPath) + '/' + fileName;

    if (sourceServerId !== destServerId) {
        if (!confirm(`Transfer ${fileName} to destination?`)) return;

        try {
            // Show some loading indication if possible, or just wait
            await api.post('/transfer', {
                source_server_id: parseInt(sourceServerId),
                source_path: srcFull,
                dest_server_id: parseInt(destServerId),
                dest_path: destFull
            });
            alert('Transfer successful! Please refresh the destination folder.');
        } catch (err) {
            alert('Transfer failed: ' + (err.response?.data || err.message));
        }
    } else {
        // Same server logic (Move/Copy/Cancel)
        transferData.value = {
            sourceServerId,
            srcPath: srcFull,
            destPath: destFull,
            fileName
        };
        showTransferModal.value = true;
    }
};

const handleTransferAction = async (action) => {
    showTransferModal.value = false;
    if (!transferData.value) return;

    const { sourceServerId, srcPath, destPath, fileName } = transferData.value;
    transferData.value = null;

    if (action === 'cancel') return;

    try {
        if (action === 'move') {
            await api.post('/sftp/move', {
                server_id: parseInt(sourceServerId),
                src_path: srcPath,
                dest_path: destPath
            });
            alert('Moved successfully! Please refresh.');
        } else if (action === 'copy') {
            await api.post('/sftp/copy', {
                server_id: parseInt(sourceServerId),
                src_path: srcPath,
                dest_path: destPath
            });
            alert('Copied successfully! Please refresh.');
        }
    } catch (err) {
        alert(`${action === 'move' ? 'Move' : 'Copy'} failed: ` + (err.response?.data || err.message));
    }
};

onMounted(() => {
    fetchUser();
    fetchServers();
    fetchFolders();
});
</script>

<style scoped>
.dashboard-layout {
    display: flex;
    height: 100vh;
    background: #383838;
    color: #e2e8f0;
    font-family: 'Inter', sans-serif;
}

.sidebar {
    width: 280px;
    background: #383838;
    border-right: 1px solid #636363;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
    z-index: 10;
    transition: width 0.3s ease, padding 0.3s ease;
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
}

.sidebar.collapsed {
    width: 60px;
    padding: 1rem 0.5rem;
}

.sidebar-header-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
}

.toggle-btn {
    color: #cbd5e1;
    font-size: 1.2rem;
    padding: 0.2rem 0.5rem;
}

.toggle-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #383838;
    padding: 0.5rem 0.5rem;
    border-radius: 12px;
    border: 1px solid #525252;
    margin-bottom: 1rem;
}

.avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #737373;
}

.user-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.user-name {
    font-weight: 600;
    color: #fff;
    font-size: 0.95rem;
    white-space: nowrap;
}

.user-email {
    font-size: 0.8rem;
    color: #9ca3af;
    white-space: nowrap;
}

.folder-list {
    flex-grow: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.folder-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    border-radius: 8px;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    transition: all 0.2s;
    font-size: 0.95rem;
}

.folder-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.folder-item.active {
    background: #525252;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    border: 1px solid #737373;
}

.folder-item.drag-hover {
    background: rgba(255, 255, 255, 0.1);
    border: 1px dashed #a3a3a3;
}

.folder-icon {
    margin-right: 0.75rem;
    font-size: 1.1rem;
}

.folder-name {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.delete-folder-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0 4px;
    opacity: 0;
    transition: opacity 0.2s;
}

.folder-item:hover .delete-folder-btn {
    opacity: 1;
}

.delete-folder-btn:hover {
    color: #ef4444;
}

.add-folder-btn {
    margin-top: 1.5rem;
    padding: 0.75rem;
    background: transparent;
    border: 1px dashed #737373;
    color: #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
    font-size: 0.9rem;
}

.add-folder-btn:hover {
    border-color: #fff;
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
}

.sidebar-footer {
    margin-top: 1rem;
}

.logout-btn {
    font-size: 0.9rem;
    width: 100%;
}

.dashboard-content {
    flex-grow: 1;
    padding: 2rem 3rem;
    overflow-y: auto;
    background: radial-gradient(circle at top right, #4b4b4b 0%, #383838 100%);
    display: flex;
    flex-direction: column;
    transition: padding 0.3s ease;
}

.dashboard-content.workspace-mode {
    padding: 0;
    background: #1e1e1e;
}

header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.header-title h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
    font-weight: 600;
}

.actions {
    display: flex;
    gap: 1rem;
}

.btn-primary {
    background: #f8fafc;
    color: #171717;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
}

.btn-primary:hover {
    background: #fff;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.btn-secondary {
    background: #383838;
    color: #cbd5e1;
    border: 1px solid #525252;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover {
    border-color: #fff;
    color: #fff;
}

.servers-section {
    flex-grow: 1;
}

.servers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
}

.server-card {
    background: rgba(31, 31, 31, 0.7);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid #525252;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    margin-bottom: 2rem;
}

.server-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: #737373;
    opacity: 0;
    transition: opacity 0.3s;
}

.server-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    border-color: #a3a3a3;
}

.server-card:hover::before {
    opacity: 1;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.card-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #fff;
    font-weight: 600;
}

.card-details {
    margin-bottom: 1.5rem;
}

.card-details p {
    margin: 0.4rem 0;
    color: #9ca3af;
    font-family: 'Menlo', monospace;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.card-body {
    margin-bottom: 1.5rem;
}

.card-body p {
    margin: 0.4rem 0;
    color: #9ca3af;
    font-family: 'Menlo', monospace;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.card-footer {
    display: flex;
    gap: 0.75rem;
    margin-top: auto;
}

.btn-connect {
    flex-grow: 1;
    background: #fff;
    color: #171717;
    border: none;
    padding: 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}

.btn-connect:hover {
    background: #e5e5e5;
}

.btn-files {
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-files:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
}

.icon-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px;
    transition: all 0.2s;
    border-radius: 4px;
}

.icon-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}

.icon-btn.delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

.empty-state {
    grid-column: 1 / -1;
    text-align: center;
    color: #9ca3af;
    padding: 4rem;
    background: rgba(30, 41, 59, 0.3);
    border-radius: 12px;
    border: 1px dashed #525252;
}

/* Panels Styles */
.panels-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.servers-mini-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
    background: #2d2d2d;
    border-bottom: 1px solid #444;
    overflow-x: auto;
    flex-shrink: 0;
}

.back-to-servers {
    font-size: 14px;
    padding: 0.5rem 1rem;
}

.mini-server-list {
    display: flex;
    gap: 1rem;
}

.mini-server-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #383838;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid #525252;
}

.mini-server-item span {
    font-size: 0.8rem;
    color: #ccc;
}

.mini-server-item button {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px;
}

.mini-server-item button:hover {
    transform: scale(1.1);
}

.panels-container {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
}

.panel-wrapper {
    flex: 1;
    min-width: 0;
    border-right: 1px solid #444;
}

.panel-wrapper:last-child {
    border-right: none;
}

/* Editor Modal */
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

.editor-modal {
    width: 80%;
    height: 80%;
    display: flex;
    flex-direction: column;
}

.editor-textarea {
    flex-grow: 1;
    background: #1e1e1e;
    color: #fff;
    border: 1px solid #444;
    padding: 1rem;
    font-family: monospace;
    resize: none;
    margin-bottom: 1rem;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}

/* Image Viewer Modal */
.image-modal {
    width: 90%;
    height: 90%;
    display: flex;
    flex-direction: column;
}

.image-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.icon-btn-close {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
}

.icon-btn-close:hover {
    color: #fff;
}

.image-container {
    flex: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
}

.image-container img {
    max-width: 100%;
    height: auto;
}

/* Responsive Styles */
@media (max-width: 1024px) {
    .dashboard-content {
        padding: 1.5rem 2rem;
    }

    .servers-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 1.5rem;
    }
}

@media (max-width: 768px) {
    .dashboard-layout {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
        max-width: 100%;
        height: auto;
        max-height: 50vh;
        border-right: none;
        border-bottom: 1px solid #444;
        padding: 1rem;
        flex-shrink: 0;
    }

    .dashboard-content {
        padding: 1rem;
        overflow-y: auto;
    }

    .servers-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
    }

    .actions {
        width: 100%;
        flex-direction: column;
    }

    .btn-primary,
    .btn-secondary {
        width: 100%;
    }

    .servers-mini-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
    }

    .mini-server-list {
        flex-direction: column;
        gap: 0.5rem;
    }

    .mini-server-item {
        justify-content: space-between;
    }

    .panels-container {
        flex-direction: column;
    }

    .panel-wrapper {
        border-right: none;
        border-bottom: 1px solid #444;
        min-height: 300px;
    }

    .panel-wrapper:last-child {
        border-bottom: none;
    }

    .card-footer {
        flex-direction: column;
    }

    .user-info {
        padding: 0.75rem;
    }

    .folder-list {
        max-height: 200px;
    }
}

@media (max-width: 480px) {
    .dashboard-content {
        padding: 0.75rem;
    }

    .header-title h2 {
        font-size: 1.25rem;
    }

    .server-card {
        padding: 1rem;
    }

    .card-header h3 {
        font-size: 1rem;
    }

    .card-body p {
        font-size: 0.8rem;
    }

    .user-name {
        font-size: 0.85rem;
    }

    .user-email {
        font-size: 0.75rem;
    }

    .folder-item {
        padding: 0.6rem 0.75rem;
        font-size: 0.9rem;
    }

    .panel-header {
        padding: 0.4rem 0.75rem;
    }

    .panel-title {
        font-size: 0.85rem;
    }
}
</style>
