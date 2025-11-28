<template>
    <div class="terminal-container">
        <div class="header" v-if="!isComponent">
            <button @click="goBack" class="back-btn">← Back</button>
            <h2>{{ serverName }}</h2>
            <div class="status" :class="{ connected: isConnected }">
                {{ isConnected ? 'Connected' : 'Disconnected' }}
            </div>
        </div>
        <div ref="terminalContainer" class="terminal-window"></div>
        <div v-if="statusMessage" class="status-overlay">
            {{ statusMessage }}
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
    serverId: { type: String, default: null },
    serverName: { type: String, default: null },
    isComponent: { type: Boolean, default: false }
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const terminalContainer = ref(null);
const isConnected = ref(false);
const serverName = ref(props.serverName || route.query.name || 'Terminal');
const statusMessage = ref('');

let term = null;
let socket = null;
let fitAddon = null;

const goBack = () => {
    router.push('/');
};

const initTerminal = () => {
    term = new Terminal({
        cursorBlink: true,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        theme: {
            background: '#1e1e1e',
            foreground: '#ffffff',
        },
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer.value);
    fitAddon.fit();

    term.onData((data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'data', content: data }));
        }
    });

    window.addEventListener('resize', handleResize);
};

const handleResize = () => {
    if (fitAddon) {
        fitAddon.fit();
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'resize',
                cols: term.cols,
                rows: term.rows
            }));
        }
    }
};

const connect = () => {
    const serverId = props.serverId || route.params.id;
    const token = authStore.token;

    if (!token) {
        router.push('/login');
        return;
    }

    const backendUrl = import.meta.env.VITE_API_BASE_URL;
    const protocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const backendHost = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}://${backendHost}/ws/ssh?server_id=${serverId}&token=${token}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        isConnected.value = true;
        term.write('\r\n*** Connected to SSH Server ***\r\n');
        handleResize(); // Send initial size
    };

    socket.onmessage = (event) => {
        if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
                term.write(new Uint8Array(reader.result));
            };
            reader.readAsArrayBuffer(event.data);
        } else {
            term.write(event.data);
        }
    };

    socket.onclose = () => {
        isConnected.value = false;
        term.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');

        let seconds = 3;
        statusMessage.value = `Connection closed. Redirecting in ${seconds}s...`;

        const interval = setInterval(() => {
            seconds--;
            statusMessage.value = `Connection closed. Redirecting in ${seconds}s...`;
            if (seconds <= 0) {
                clearInterval(interval);
                router.push('/');
            }
        }, 1000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        term.write('\r\n*** WebSocket Error ***\r\n');
    };
};

onMounted(() => {
    initTerminal();
    connect();
});

onBeforeUnmount(() => {
    if (socket) {
        socket.close();
    }
    if (term) {
        term.dispose();
    }
    window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.terminal-container {
    display: flex;
    flex-direction: column;
    height: 80vh;
    background: #1e1e1e;
    position: relative;
}

.header {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
}

.back-btn {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    margin-right: 1rem;
    font-size: 1rem;
}

.back-btn:hover {
    color: #fff;
}

h2 {
    margin: 0;
    font-size: 1rem;
    flex-grow: 1;
    text-align: center;
}

.status {
    font-size: 0.8rem;
    color: #ff4444;
}

.status.connected {
    color: #00cc00;
}

.terminal-window {
    flex-grow: 1;
    padding: 0.5rem;
    overflow: hidden;
}

.status-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1.2rem;
    z-index: 100;
}
</style>
