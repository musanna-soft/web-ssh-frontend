<template>
    <div class="file-manager-layout">
        <header>
            <div class="header-left">
                <button @click="goBack" class="btn-secondary">← Back</button>
                <h2>{{ serverName }} - Files</h2>
            </div>
            <div class="actions">
                <label class="btn-primary upload-btn">
                    Upload
                    <input type="file" @change="handleUpload" hidden />
                </label>
            </div>
        </header>

        <div class="panes-container">
            <FilePane ref="leftPane" paneId="left" :serverId="serverId" initialPath="/" @open-file="openFile"
                @download-file="downloadFile" @download-zip="downloadZip" @drop-file="handleCrossPaneDrop"
                class="pane" />
            <FilePane ref="rightPane" paneId="right" :serverId="serverId" initialPath="/" @open-file="openFile"
                @download-file="downloadFile" @download-zip="downloadZip" @drop-file="handleCrossPaneDrop"
                class="pane" />
        </div>

        <!-- Editor Modal -->
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

        <!-- Image Viewer Modal -->
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

        <!-- Copy/Move Modal -->
        <div v-if="dropModalOpen" class="modal-overlay">
            <div class="modal-content">
                <h3>Action Required</h3>
                <p>Do you want to Copy or Move <b>{{ dropData.fileName }}</b>?</p>
                <div class="modal-actions">
                    <button @click="dropModalOpen = false" class="btn-secondary">Cancel</button>
                    <button @click="executeDrop('copy')" class="btn-primary">Copy</button>
                    <button @click="executeDrop('move')" class="btn-primary">Move</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import FilePane from '../components/FilePane.vue';

const route = useRoute();
const router = useRouter();

const serverId = route.params.id;
const serverName = route.query.name || 'Server';

const leftPane = ref(null);
const rightPane = ref(null);

// Editor State
const editorOpen = ref(false);
const editingFile = ref('');
const fileContent = ref('');
const editingPath = ref(''); // Store full path

// Image Viewer State
const imageViewerOpen = ref(false);
const imageSrc = ref('');

// Drop State
const dropModalOpen = ref(false);
const dropData = ref({});

const goBack = () => {
    router.push('/');
};

const openFile = async (name, dirPath) => {
    const path = (dirPath === '/' ? '' : dirPath) + '/' + name;
    const ext = name.split('.').pop().toLowerCase();

    const textExts = ['txt', 'md', 'json', 'js', 'go', 'html', 'css', 'vue', 'log', 'conf', 'sh', 'yaml', 'yml', 'xml', 'env', 'gitignore'];
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

    if (textExts.includes(ext)) {
        // Open Editor
        try {
            const res = await api.get(`/sftp/content?server_id=${serverId}&path=${encodeURIComponent(path)}`);
            fileContent.value = res.data;
            editingFile.value = name;
            editingPath.value = path;
            editorOpen.value = true;
        } catch (err) {
            alert('Failed to open file: ' + err.message);
        }
    } else if (imgExts.includes(ext)) {
        // Open Image Viewer
        // We can use the download endpoint to fetch the image blob
        const url = `http://localhost:8080/api/sftp/download?server_id=${serverId}&path=${encodeURIComponent(path)}`;
        api.get(url, { responseType: 'blob' })
            .then(response => {
                imageSrc.value = window.URL.createObjectURL(new Blob([response.data]));
                editingFile.value = name;
                imageViewerOpen.value = true;
            })
            .catch(err => alert('Failed to load image: ' + err.message));
    } else {
        // Download
        downloadFile(name, dirPath);
    }
};

const closeEditor = () => {
    editorOpen.value = false;
    editingFile.value = '';
    fileContent.value = '';
    editingPath.value = '';
};

const closeImageViewer = () => {
    imageViewerOpen.value = false;
    imageSrc.value = '';
    editingFile.value = '';
};

const saveFile = async () => {
    try {
        await api.post('/sftp/content', {
            server_id: parseInt(serverId),
            path: editingPath.value,
            content: fileContent.value
        });
        closeEditor();
        alert('File saved successfully');
    } catch (err) {
        alert('Failed to save file: ' + err.message);
    }
};

const downloadFile = (name, dirPath, callback) => {
    const path = (dirPath === '/' ? '' : dirPath) + '/' + name;
    const url = `http://localhost:8080/api/sftp/download?server_id=${serverId}&path=${encodeURIComponent(path)}`;

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
            if (callback) callback();
        });
};

const downloadZip = (name, dirPath, callback) => {
    const path = (dirPath === '/' ? '' : dirPath) + '/' + name;
    const url = `http://localhost:8080/api/sftp/zip?server_id=${serverId}&path=${encodeURIComponent(path)}`;

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
            if (callback) callback();
        });
};

const handleUpload = async (event) => {
    alert("Please use the + button inside the pane to create folders. File upload should be added to panes directly.");
};

const handleCrossPaneDrop = (data) => {
    dropData.value = data;
    dropModalOpen.value = true;
};

const executeDrop = async (action) => {
    const { fileName, sourcePath, destPath, isSamePane } = dropData.value;
    const src = (sourcePath === '/' ? '' : sourcePath) + '/' + fileName;
    const dest = (destPath === '/' ? '' : destPath) + '/' + fileName;

    const endpoint = action === 'move' ? '/sftp/move' : '/sftp/copy';

    try {
        await api.post(endpoint, {
            server_id: parseInt(serverId),
            src_path: src,
            dest_path: dest
        });

        // Refresh panes
        if (isSamePane) {
            // If same pane, we only need to refresh that pane, but refreshing both is safe
            leftPane.value.refresh();
            rightPane.value.refresh();
        } else {
            leftPane.value.refresh();
            rightPane.value.refresh();
        }
        dropModalOpen.value = false;
    } catch (err) {
        alert(`Failed to ${action}: ` + err.message);
    }
};
</script>

<style scoped>
.file-manager-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1e1e1e;
    color: #fff;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

h2 {
    margin: 0;
    font-size: 1.2rem;
}

.panes-container {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
}

.pane {
    flex: 1;
    border-right: 1px solid #444;
}

.pane:last-child {
    border-right: none;
}

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

.btn-primary {
    background: #007bff;
    color: white;
    border: 1px solid #007bff;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
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
