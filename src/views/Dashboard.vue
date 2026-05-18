<template>
    <div class="dashboard-wrapper">
        <div v-if="showGraceBanner" class="grace-banner">
            🔔 MFA <b>{{ formattedGrace }}</b> dan majburiy.
            <router-link to="/mfa/setup">Sozlash</router-link>
        </div>

        <div class="dashboard-layout">
            <!-- Mobile drawer backdrop. Only visible on small screens when the drawer is open. -->
            <div
                class="sidebar-backdrop"
                :class="{ 'is-visible': showSidebar }"
                @click="showSidebar = false"
                aria-hidden="true"
            ></div>

            <aside class="sidebar" :class="{ 'is-open': showSidebar }" aria-label="Folders">
                <div class="sidebar-head">
                    <div class="user-info" v-if="user">
                        <img :src="user.avatar_url" alt="" class="avatar" />
                        <div class="user-details">
                            <span class="user-name">{{ user.name }}</span>
                            <span class="user-email">{{ user.email }}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="sidebar-close"
                        @click="showSidebar = false"
                        aria-label="Close sidebar"
                    >×</button>
                </div>

                <div class="folder-list">
                    <div
                        class="folder-item"
                        :class="{ active: !selectedFolder, 'drag-hover': dragOverFolderId === 'all' }"
                        @click="selectFolder(null)"
                        @dragover.prevent
                        @dragenter="dragOverFolderId = 'all'"
                        @dragleave="dragOverFolderId === 'all' ? dragOverFolderId = null : null"
                        @drop="handleDrop($event, null)"
                        title="All Servers"
                    >
                        <span class="folder-icon" aria-hidden="true">📁</span>
                        <span class="folder-name">All Servers</span>
                    </div>
                    <div
                        v-for="folder in folders"
                        :key="folder.id"
                        class="folder-item"
                        :class="{ active: selectedFolder === folder.id, 'drag-hover': dragOverFolderId === folder.id }"
                        @click="selectFolder(folder.id)"
                        @dragover.prevent
                        @dragenter="dragOverFolderId = folder.id"
                        @dragleave="dragOverFolderId === folder.id ? dragOverFolderId = null : null"
                        @drop="handleDrop($event, folder.id)"
                        :title="folder.name"
                    >
                        <span class="folder-icon" aria-hidden="true">📂</span>
                        <span class="folder-name">{{ folder.name }}</span>
                        <button class="delete-folder-btn" @click.stop="deleteFolder(folder.id)" aria-label="Delete folder">×</button>
                    </div>
                </div>

                <button class="add-folder-btn" @click="createFolder">
                    <span>+ New Folder</span>
                </button>

                <div class="sidebar-footer">
                    <a
                        href="https://t.me/remofybot"
                        target="_blank"
                        rel="noopener"
                        class="btn-secondary tg-btn"
                        title="Telegram botda davom ettirish"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path fill="currentColor" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                        </svg>
                        <span>Telegram bot</span>
                    </a>
                    <router-link to="/mfa/settings" class="btn-secondary mfa-btn">
                        🔐 MFA
                    </router-link>
                    <button @click="logout" class="btn-secondary logout-btn">
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <main class="dashboard-content" :class="{ 'workspace-mode': panelStore.panels.length > 0 }">
                <!-- Topbar: hamburger + title + action. Shown on mobile, in dashboard mode only.
                     Desktop has its own header below. -->
                <div class="topbar">
                    <button
                        type="button"
                        class="hamburger"
                        @click="showSidebar = !showSidebar"
                        :aria-expanded="showSidebar"
                        aria-label="Toggle sidebar"
                    >
                        <span class="hamburger-bar"></span>
                        <span class="hamburger-bar"></span>
                        <span class="hamburger-bar"></span>
                    </button>
                    <div class="topbar-title">{{ panelStore.panels.length === 0 ? currentFolderName : 'Workspace' }}</div>
                    <button
                        v-if="panelStore.panels.length === 0"
                        type="button"
                        class="topbar-action"
                        @click="openModal"
                        aria-label="Add server"
                    >+</button>
                    <button
                        v-else
                        type="button"
                        class="topbar-action"
                        @click="panelStore.panels = []; showSidebar = true;"
                        aria-label="Back to servers"
                    >←</button>
                </div>

                <header v-if="panelStore.panels.length === 0" class="desktop-header">
                    <div class="header-title">
                        <h2>{{ currentFolderName }}</h2>
                    </div>
                    <div class="actions">
                        <button @click="openModal" class="btn-primary">+ Add Server</button>
                    </div>
                </header>

                <div class="servers-section" v-if="panelStore.panels.length === 0">
                    <div class="servers-grid">
                        <div
                            v-for="server in filteredServers"
                            :key="server.id"
                            class="server-card"
                            draggable="true"
                            @dragstart="handleDragStart(server, $event)"
                        >
                            <div class="card-header">
                                <h3>{{ server.name }}</h3>
                                <div class="card-actions">
                                    <button @click="editServer(server)" class="icon-btn" title="Edit" aria-label="Edit">✎</button>
                                    <button @click="deleteServer(server.id)" class="icon-btn delete" title="Delete" aria-label="Delete">🗑</button>
                                </div>
                            </div>
                            <div class="card-body">
                                <p><span class="card-label">Host</span><span class="card-value">{{ server.host }}</span></p>
                                <p><span class="card-label">User</span><span class="card-value">{{ server.username }}</span></p>
                            </div>
                            <div class="card-footer">
                                <button
                                    @click="addPanel('terminal', server.id, server.name, server.username)"
                                    class="btn-connect"
                                >Terminal</button>
                                <button
                                    @click="addPanel('sftp', server.id, server.name, server.username)"
                                    class="btn-files"
                                    title="File Manager"
                                    aria-label="Open file manager"
                                >📂</button>
                            </div>
                        </div>

                        <div v-if="filteredServers.length === 0" class="empty-state">
                            <p>Hozircha hech qanday server qo'shilmagan.</p>
                            <button @click="openModal" class="btn-primary">+ Birinchi serverni qo'shing</button>
                        </div>
                    </div>
                </div>

                <!-- Active panels -->
                <div class="panels-grid" v-else>
                    <div class="servers-mini-bar">
                        <button
                            @click="panelStore.panels = []; showSidebar = true;"
                            class="btn-secondary back-to-servers"
                        >← Servers</button>
                        <div class="mini-server-list">
                            <div v-for="server in filteredServers" :key="server.id" class="mini-server-item">
                                <span>{{ server.name }}</span>
                                <button @click="addPanel('terminal', server.id, server.name, server.username)" title="Terminal" aria-label="Terminal">💻</button>
                                <button @click="addPanel('sftp', server.id, server.name, server.username)" title="SFTP" aria-label="SFTP">📂</button>
                            </div>
                        </div>
                    </div>

                    <div class="panels-container" ref="panelsContainer">
                        <template v-for="(panel, index) in panelStore.panels" :key="panel.id">
                            <PanelContainer
                                :panel="panel"
                                @close="removePanel"
                                @open-file="handleOpenFile"
                                @download-file="handleDownloadFile"
                                @download-zip="handleDownloadZip"
                                @drop-file="handleCrossPaneDrop"
                                class="panel-wrapper"
                                :style="!isStackedPanels ? { flex: `0 0 ${panelSizes[index]}%` } : null"
                            />
                            <div
                                v-if="!isStackedPanels && index < panelStore.panels.length - 1"
                                class="panel-resizer"
                                @mousedown="startResize(index, $event)"
                            ></div>
                        </template>
                    </div>
                </div>
            </main>
        </div>

        <ServerModal :isOpen="isModalOpen" :server="editingServer" :folders="folders" @close="closeModal" @save="saveServer" />

        <!-- Editor Modal -->
        <div v-if="editorOpen" class="modal-overlay">
            <div class="modal-content editor-modal">
                <div class="editor-head">
                    <h2>Edit File: <span class="filename">{{ editingFile }}</span></h2>
                    <button @click="closeEditor" class="icon-btn-close" aria-label="Close">×</button>
                </div>
                <textarea v-model="fileContent" class="editor-textarea"></textarea>
                <div class="modal-actions">
                    <button @click="closeEditor" class="btn-secondary">Cancel</button>
                    <button @click="saveFile" class="btn-primary">Save</button>
                </div>
            </div>
        </div>

        <!-- Image Viewer Modal -->
        <div v-if="imageViewerOpen" class="modal-overlay" @click.self="closeImageViewer">
            <div class="modal-content image-modal">
                <div class="image-header">
                    <h2 class="filename">{{ editingFile }}</h2>
                    <button @click="closeImageViewer" class="icon-btn-close" aria-label="Close">×</button>
                </div>
                <div class="image-container">
                    <img :src="imageSrc" alt="Preview" />
                </div>
            </div>
        </div>

        <TransferChoiceModal
            :isOpen="showTransferModal"
            :fileName="transferData?.fileName || ''"
            :destPath="transferData?.destPath || ''"
            @action="handleTransferAction"
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { useAuthStore } from '../stores/auth';
import { useMFAStore } from '../stores/mfa';
import { usePanelStore } from '../stores/panels';
import ServerModal from '../components/ServerModal.vue';
import PanelContainer from '../components/PanelContainer.vue';
import TransferChoiceModal from '../components/TransferChoiceModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const mfaStore = useMFAStore();
const panelStore = usePanelStore();
const user = computed(() => authStore.user);

const showGraceBanner = computed(
    () => !!mfaStore.graceUntil && !mfaStore.enrolled
);
const formattedGrace = computed(() => {
    if (!mfaStore.graceUntil) return '';
    try {
        return new Date(mfaStore.graceUntil).toISOString().slice(0, 10);
    } catch (_) {
        return mfaStore.graceUntil;
    }
});

const servers = ref([]);
const folders = ref([]);
const selectedFolder = ref(null);
const isModalOpen = ref(false);
const editingServer = ref(null);
const dragOverFolderId = ref(null);

// Sidebar visibility — default open on desktop, closed on mobile. We don't
// reactively re-evaluate after mount: rotation between portrait/landscape on
// a tablet shouldn't slam the drawer open/closed under the user's finger.
const showSidebar = ref(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
);

// Panels stack vertically on small screens (mouse resize is meaningless on
// touch). Recomputed on resize.
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const isStackedPanels = computed(() => viewportWidth.value < 768);
const updateViewportWidth = () => { viewportWidth.value = window.innerWidth; };

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

// Panel Resizing State (desktop only)
const panelsContainer = ref(null);
const panelSizes = ref([]);
const isResizing = ref(false);
const currentResizeIndex = ref(-1);

const startResize = (index, event) => {
    if (isStackedPanels.value) return;
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
    const mousePercent = (mouseX / containerWidth) * 100;

    let previousWidth = 0;
    for (let i = 0; i < currentResizeIndex.value; i++) {
        previousWidth += panelSizes.value[i];
    }

    let newWidth = mousePercent - previousWidth;
    if (newWidth < 10) newWidth = 10;

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

watch(() => panelStore.panels, (newPanels, oldPanels) => {
    if (newPanels.length > 0 && (!oldPanels || oldPanels.length === 0)) {
        showSidebar.value = false;
    }

    if (newPanels.length === 0) {
        panelSizes.value = [];
        return;
    }
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
    // On small screens the sidebar is an overlay drawer — close it once a
    // folder is picked so the user sees the result without an extra tap.
    if (window.innerWidth < 1024) {
        showSidebar.value = false;
    }
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
        fetchServers();
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

    const originalFolderId = server.folder_id;
    server.folder_id = folderId;

    try {
        const payload = {
            name: server.name,
            host: server.host,
            port: server.port,
            username: server.username,
            auth_type: server.auth_type,
            folder_id: folderId,
            secret: ""
        };

        await api.put(`/servers?id=${serverId}`, payload);
    } catch (err) {
        server.folder_id = originalFolderId;
        alert("Failed to move server: " + err.message);
    }
};

const addPanel = (type, serverId, serverName, username) => {
    showSidebar.value = false;
    panelStore.addPanel(type, serverId.toString(), serverName, username);
};

const removePanel = (id) => {
    panelStore.removePanel(id);
    if (panelStore.panels.length === 0) {
        showSidebar.value = window.innerWidth >= 1024;
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
    setTimeout(() => {
        try {
            window.URL.revokeObjectURL(url);
        } catch (e) { /* ignore */ }
    }, 0);
};

const handleOpenFile = async ({ serverId, name, path, size }) => {
    const fullPath = (path === '/' ? '' : path) + '/' + name;
    const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

    const downloadRelUrl = `/sftp/download?server_id=${serverId}&path=${encodeURIComponent(fullPath)}`;

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
                try { window.URL.revokeObjectURL(imageSrc.value); } catch (e) { /* ignore */ }
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
        try { window.URL.revokeObjectURL(imageSrc.value); } catch (e) { /* ignore */ }
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
        .finally(() => { if (cb) cb(); });
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
        .finally(() => { if (cb) cb(); });
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
    window.addEventListener('resize', updateViewportWidth);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewportWidth);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
});
</script>

<style scoped>
/* ============================================================
 * Dashboard — desktop and mobile (drawer pattern)
 * ============================================================ */

.dashboard-wrapper {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg-app);
    color: var(--text-primary);
    font-family: var(--font-sans);
}

.dashboard-layout {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
}

/* ── Grace banner ───────────────────────────────────────── */
.grace-banner {
    flex: 0 0 auto;
    background: rgba(245, 158, 11, 0.12);
    color: #fde68a;
    border-bottom: 1px solid rgba(245, 158, 11, 0.35);
    padding: 8px 16px;
    font-size: 13px;
    line-height: 1.4;
}

.grace-banner a {
    color: #fde68a;
    text-decoration: underline;
    margin-left: 4px;
}

/* ── Sidebar (desktop: inline, mobile: drawer) ──────────── */
.sidebar {
    width: 280px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-subtle);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    overflow-x: hidden;
    transition: transform var(--dur-base) var(--ease);
    z-index: var(--z-drawer);
}

.sidebar-head {
    display: flex;
    align-items: center;
    gap: 8px;
}

.user-info {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-surface-2);
    border: 1px solid var(--border-subtle);
    padding: 8px 10px;
    border-radius: var(--radius-md);
    min-width: 0;
}

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border-default);
    flex-shrink: 0;
}

.user-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.user-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-email {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sidebar-close {
    display: none;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    transition: background var(--dur-fast) var(--ease);
}

.sidebar-close:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
}

.folder-list {
    flex: 1 1 auto;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
}

.folder-item {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
    transition: background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
    font-size: 14px;
    min-height: 40px;
    cursor: pointer;
}

.folder-item:hover {
    background: var(--bg-surface-2);
    color: var(--text-primary);
}

.folder-item.active {
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid var(--accent-ring);
}

.folder-item.drag-hover {
    background: var(--bg-surface-3);
    outline: 1px dashed var(--accent);
    outline-offset: -2px;
}

.folder-icon { font-size: 16px; flex-shrink: 0; }

.folder-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.delete-folder-btn {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    color: var(--text-tertiary);
    font-size: 16px;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease),
                background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
    flex-shrink: 0;
}

.folder-item:hover .delete-folder-btn,
.delete-folder-btn:focus-visible {
    opacity: 1;
}

.delete-folder-btn:hover {
    background: var(--danger-soft);
    color: var(--danger-hover);
}

.add-folder-btn {
    padding: 10px 12px;
    background: transparent;
    border: 1px dashed var(--border-default);
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    width: 100%;
    font-size: 13px;
    min-height: 40px;
    transition: border-color var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease),
                background var(--dur-fast) var(--ease);
}

.add-folder-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
}

.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
}

.mfa-btn,
.logout-btn,
.tg-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    color: var(--text-primary);
    background: var(--bg-surface-2);
    border: 1px solid var(--border-default);
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease);
}

.mfa-btn:hover,
.logout-btn:hover,
.tg-btn:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-strong);
}

.tg-btn {
    color: #229ED9;
}

/* ── Sidebar backdrop (mobile only) ─────────────────────── */
.sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    z-index: var(--z-overlay);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-base) var(--ease);
}

/* ── Main content ───────────────────────────────────────── */
.dashboard-content {
    flex: 1 1 auto;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: var(--bg-app);
}

.dashboard-content.workspace-mode {
    overflow: hidden;
}

/* ── Topbar (mobile-only by default) ────────────────────── */
.topbar {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    padding-top: max(10px, env(safe-area-inset-top));
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    z-index: 20;
}

.hamburger {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    flex-shrink: 0;
    transition: background var(--dur-fast) var(--ease);
}

.hamburger:hover { background: var(--bg-surface-3); }

.hamburger-bar {
    display: block;
    width: 18px;
    height: 2px;
    background: currentColor;
    border-radius: 2px;
    margin: 3px 0;
}

.topbar-title {
    flex: 1 1 auto;
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.topbar-action {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    flex-shrink: 0;
    transition: background var(--dur-fast) var(--ease);
}

.topbar-action:hover { background: var(--accent-hover); }

/* ── Desktop header (visible >= 768px) ──────────────────── */
.desktop-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 24px 32px;
    flex-shrink: 0;
}

.header-title h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
}

.actions { display: flex; gap: 10px; }

.btn-primary {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    min-height: var(--tap-target);
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
}

.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { transform: translateY(1px); }

.btn-secondary {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    padding: 10px 16px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 14px;
    min-height: var(--tap-target);
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease);
}

.btn-secondary:hover {
    background: var(--bg-surface-3);
    border-color: var(--border-strong);
}

/* ── Servers grid ───────────────────────────────────────── */
.servers-section {
    flex: 1 1 auto;
    padding: 0 32px 32px;
}

.servers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
}

.server-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 18px;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease),
                border-color var(--dur-base) var(--ease),
                box-shadow var(--dur-base) var(--ease);
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
}

.server-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
}

.card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
}

.card-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
}

.card-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.card-body p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--text-secondary);
    font-size: 13px;
}

.card-label {
    color: var(--text-tertiary);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    min-width: 40px;
}

.card-value {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.card-footer {
    display: flex;
    gap: 8px;
    margin-top: auto;
}

.btn-connect {
    flex: 1 1 auto;
    min-height: var(--tap-target);
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 10px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
    transition: background var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
}

.btn-connect:hover { background: var(--accent-hover); }
.btn-connect:active { transform: translateY(1px); }

.btn-files {
    min-width: var(--tap-target);
    min-height: var(--tap-target);
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
    font-size: 16px;
}

.btn-files:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
    border-color: var(--border-strong);
}

.icon-btn {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    font-size: 14px;
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

.empty-state {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-secondary);
    padding: 48px 24px;
    background: var(--bg-surface);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-lg);
}

.empty-state p { margin: 0 0 14px; }

/* ── Panels (workspace) ─────────────────────────────────── */
.panels-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.servers-mini-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
}

.servers-mini-bar::-webkit-scrollbar { display: none; }

.back-to-servers {
    font-size: 13px;
    padding: 6px 12px;
    min-height: 32px;
    flex-shrink: 0;
}

.mini-server-list {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}

.mini-server-item {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-surface-2);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    flex-shrink: 0;
}

.mini-server-item span {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
}

.mini-server-item button {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 14px;
    transition: background var(--dur-fast) var(--ease);
}

.mini-server-item button:hover { background: var(--bg-surface-3); }

.panels-container {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

.panel-wrapper {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--border-subtle);
}

.panel-wrapper:last-child { border-right: none; }

.panel-resizer {
    width: 6px;
    flex-shrink: 0;
    cursor: col-resize;
    background: transparent;
    position: relative;
    transition: background var(--dur-fast) var(--ease);
}

.panel-resizer:hover,
.panel-resizer:active {
    background: var(--accent-soft);
}

/* ── Modals (editor + image viewer) ─────────────────────── */
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
    padding: 20px;
    border-radius: var(--radius-xl);
    width: 100%;
    box-shadow: var(--shadow-lg);
    max-height: calc(100dvh - 48px);
    display: flex;
    flex-direction: column;
    animation: pop-in var(--dur-base) var(--ease);
}

@keyframes fade-in { from { opacity: 0; } }
@keyframes pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
}

.modal-content h2 {
    margin: 0;
    font-size: 16px;
    color: var(--text-primary);
}

.filename {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
    word-break: break-all;
}

.editor-modal {
    width: 100%;
    max-width: 960px;
    height: 80dvh;
}

.editor-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
}

.editor-textarea {
    flex: 1 1 auto;
    min-height: 0;
    background: var(--bg-app);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    margin-bottom: 14px;
    transition: border-color var(--dur-fast) var(--ease),
                box-shadow var(--dur-fast) var(--ease);
}

.editor-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.image-modal {
    width: 100%;
    max-width: 1080px;
    max-height: calc(100dvh - 48px);
}

.image-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.icon-btn-close {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    transition: background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
}

.icon-btn-close:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
}

.image-container {
    flex: 1 1 auto;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background: var(--bg-app);
    border-radius: var(--radius-md);
    padding: 12px;
}

.image-container img {
    max-width: 100%;
    height: auto;
}

/* ============================================================
 * Responsive
 * ============================================================ */

/* ── < 1024px: drawer mode ──────────────────────────────── */
@media (max-width: 1023px) {
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: min(320px, 86vw);
        padding-top: max(16px, env(safe-area-inset-top));
        padding-bottom: max(16px, env(safe-area-inset-bottom));
        padding-left: max(16px, env(safe-area-inset-left));
        transform: translateX(-100%);
        box-shadow: var(--shadow-lg);
    }

    .sidebar.is-open { transform: translateX(0); }

    .sidebar-close {
        display: grid;
    }

    .sidebar-backdrop {
        display: block;
    }

    .sidebar-backdrop.is-visible {
        opacity: 1;
        pointer-events: auto;
    }

    .topbar { display: flex; }
    .desktop-header { display: none; }

    .servers-section { padding: 16px; }
    .servers-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
    }
}

/* ── < 768px: phones ────────────────────────────────────── */
@media (max-width: 767px) {
    .servers-grid { grid-template-columns: 1fr; gap: 12px; }
    .server-card { padding: 16px; }
    .card-header h3 { font-size: 15px; }
    .card-body p { font-size: 13px; }

    .servers-mini-bar {
        padding: 6px 10px;
        padding-left: max(10px, env(safe-area-inset-left));
        padding-right: max(10px, env(safe-area-inset-right));
    }

    .mini-server-item span { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }

    .panels-container {
        flex-direction: column;
        overflow-y: auto;
    }

    .panel-wrapper {
        flex: 0 0 70dvh;
        min-height: 70dvh;
        border-right: none;
        border-bottom: 1px solid var(--border-subtle);
    }

    .panel-wrapper:last-child { border-bottom: none; }

    .panel-resizer { display: none; }

    .modal-overlay { padding: 0; align-items: stretch; }

    .modal-content {
        border-radius: 0;
        max-height: 100dvh;
        padding: 16px;
        padding-top: max(16px, env(safe-area-inset-top));
        padding-bottom: max(16px, env(safe-area-inset-bottom));
    }

    .editor-modal { height: 100dvh; }
}

/* ── < 480px: small phones ──────────────────────────────── */
@media (max-width: 479px) {
    .grace-banner { font-size: 12px; padding: 6px 12px; }
    .empty-state { padding: 32px 16px; }
    .card-footer { flex-direction: row; }
    .modal-actions { flex-direction: column-reverse; }
    .modal-actions .btn-primary,
    .modal-actions .btn-secondary { width: 100%; }
}
</style>
