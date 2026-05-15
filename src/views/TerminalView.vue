<template>
    <div class="terminal-container">
        <div class="header" v-if="!isComponent">
            <button @click="goBack" class="back-btn" type="button" aria-label="Back">
                <span aria-hidden="true">←</span>
                <span class="back-label">Back</span>
            </button>
            <h2 class="server-title">{{ serverName }}</h2>
            <div class="status" :class="{ connected: isConnected }">
                <span class="status-dot" aria-hidden="true"></span>
                <span class="status-label">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
            </div>
        </div>

        <div ref="terminalContainer" class="terminal-window"></div>

        <!-- Touch keyboard helpers — shown when a coarse pointer is detected.
             Sends raw escape sequences over the same WebSocket. -->
        <div
            v-if="showTouchBar"
            class="touch-bar"
            role="toolbar"
            aria-label="Terminal helper keys"
        >
            <button type="button" class="key" :class="{ active: ctrlArmed }" @click="toggleCtrl" aria-pressed="ctrlArmed">Ctrl</button>
            <button type="button" class="key" @click="sendSeq('\x1b')">Esc</button>
            <button type="button" class="key" @click="sendSeq('\t')">Tab</button>
            <button type="button" class="key" @click="sendSeq('|')">|</button>
            <button type="button" class="key" @click="sendSeq('~')">~</button>
            <button type="button" class="key" @click="sendSeq('/')">/</button>
            <button type="button" class="key" @click="sendSeq('-')">-</button>
            <span class="spacer" aria-hidden="true"></span>
            <button type="button" class="key arrow" @click="sendSeq('\x1b[D')" aria-label="Left">◀</button>
            <button type="button" class="key arrow" @click="sendSeq('\x1b[B')" aria-label="Down">▼</button>
            <button type="button" class="key arrow" @click="sendSeq('\x1b[A')" aria-label="Up">▲</button>
            <button type="button" class="key arrow" @click="sendSeq('\x1b[C')" aria-label="Right">▶</button>
        </div>

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

// Touch keyboard bar: visible on coarse pointers (touch). Persists for the
// life of the component — we don't reactively re-evaluate on rotation,
// which is fine: a tablet doesn't switch pointer kind mid-session.
const showTouchBar = ref(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches
);
const ctrlArmed = ref(false);

let term = null;
let socket = null;
let fitAddon = null;
let pingInterval = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let isUnmounting = false;
let resizeObserver = null;

const goBack = () => {
    router.push('/');
};

const initTerminal = () => {
    const isCoarse = typeof window !== 'undefined' &&
        window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    term = new Terminal({
        cursorBlink: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", monospace',
        fontSize: isCoarse ? 13 : 14,
        lineHeight: 1.2,
        theme: {
            background: '#0f1115',
            foreground: '#e7eaf0',
            cursor: '#e7eaf0',
            cursorAccent: '#0f1115',
            selectionBackground: 'rgba(110, 168, 255, 0.35)',
        },
        allowProposedApi: true,
        macOptionIsMeta: true,
        scrollback: 5000,
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer.value);
    fitAddon.fit();

    term.onSelectionChange(() => {
        const selection = term.getSelection();
        if (selection) {
            copyToClipboard(selection);
        }
    });

    term.onData((data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'data', content: data }));
        }
    });

    terminalContainer.value.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(terminalContainer.value);
    }
};

const handleResize = () => {
    if (fitAddon) {
        try {
            fitAddon.fit();
        } catch (_) { /* container detached during teardown */ }
        if (socket && socket.readyState === WebSocket.OPEN && term) {
            socket.send(JSON.stringify({
                type: 'resize',
                cols: term.cols,
                rows: term.rows
            }));
        }
    }
};

const handleKeyDown = (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        event.stopPropagation();
        const selection = term.getSelection();
        if (selection) {
            copyToClipboard(selection);
            term.write('\r\n\x1b[32m[Copied to clipboard]\x1b[0m\r\n');
        }
        return false;
    }
};

const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy text:', err);
    }
};

const sendSeq = (seq) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    let payload = seq;

    if (ctrlArmed.value && seq.length === 1) {
        const c = seq.toLowerCase().charCodeAt(0);
        if (c >= 97 && c <= 122) {
            // a..z → 0x01..0x1A (Ctrl-A..Ctrl-Z)
            payload = String.fromCharCode(c - 96);
        }
        ctrlArmed.value = false;
    }

    socket.send(JSON.stringify({ type: 'data', content: payload }));
    if (term) term.focus();
};

const toggleCtrl = () => {
    ctrlArmed.value = !ctrlArmed.value;
    if (term) term.focus();
};

const startPingInterval = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
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
        term.write('\r\n\x1b[31mMax reconnection attempts reached. Please refresh the page.\x1b[0m\r\n');
        statusMessage.value = 'Connection lost. Please refresh the page.';
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);

    term.write(`\r\n\x1b[33mReconnecting in ${delay / 1000}s... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})\x1b[0m\r\n`);

    reconnectTimeout = setTimeout(() => {
        connect();
    }, delay);
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
        reconnectAttempts = 0;
        term.write('\r\n*** Connected to SSH Server ***\r\n');
        handleResize();
        startPingInterval();
    };

    socket.onmessage = (event) => {
        if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
                term.write(new Uint8Array(reader.result));
            };
            reader.readAsArrayBuffer(event.data);
        } else {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'pong') return;
            } catch (e) {
                term.write(event.data);
            }
        }
    };

    socket.onclose = (event) => {
        isConnected.value = false;
        stopPingInterval();

        if (isUnmounting) return;

        if (event.code !== 1000) {
            term.write('\r\n\x1b[33mConnection lost. Attempting to reconnect...\x1b[0m\r\n');
            attemptReconnect();
        } else {
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
        }
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
    isUnmounting = true;
    cleanup();
    if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (_) { /* ignore */ }
        resizeObserver = null;
    }
    if (socket) {
        socket.close(1000, 'Component unmounting');
    }
    if (terminalContainer.value) {
        terminalContainer.value.removeEventListener('keydown', handleKeyDown);
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
    height: 100%;
    min-height: 0;
    background: var(--bg-app);
    position: relative;
}

.header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
}

.back-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    min-height: 36px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    transition: background var(--dur-fast) var(--ease),
                color var(--dur-fast) var(--ease);
}

.back-btn:hover {
    background: var(--bg-surface-3);
    color: var(--text-primary);
}

.server-title {
    flex: 1 1 auto;
    margin: 0;
    font-size: 15px;
    color: var(--text-primary);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}

.status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--danger);
    flex-shrink: 0;
}

.status.connected { color: var(--success); }

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 25%, transparent);
}

.terminal-window {
    flex: 1 1 auto;
    min-height: 0;
    padding: 6px 8px;
    overflow: hidden;
}

/* xterm itself needs to fill the window. */
.terminal-window :deep(.xterm),
.terminal-window :deep(.xterm-viewport),
.terminal-window :deep(.xterm-screen) {
    height: 100% !important;
}

.touch-bar {
    display: flex;
    gap: 6px;
    padding: 8px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    background: var(--bg-surface);
    border-top: 1px solid var(--border-subtle);
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
    align-items: center;
}

.touch-bar::-webkit-scrollbar { display: none; }

.touch-bar .key {
    min-width: 44px;
    height: 38px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-surface-2);
    border: 1px solid var(--border-default);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    flex-shrink: 0;
    transition: background var(--dur-fast) var(--ease),
                border-color var(--dur-fast) var(--ease),
                transform var(--dur-fast) var(--ease);
}

.touch-bar .key:active {
    background: var(--bg-surface-3);
    transform: translateY(1px);
}

.touch-bar .key.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
}

.touch-bar .key.arrow {
    min-width: 40px;
    font-size: 14px;
}

.touch-bar .spacer {
    width: 1px;
    height: 24px;
    background: var(--border-subtle);
    margin: 0 4px;
    flex-shrink: 0;
}

.status-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--bg-overlay-strong);
    color: var(--text-primary);
    padding: 14px 20px;
    border-radius: var(--radius-md);
    font-size: 15px;
    z-index: 10;
    border: 1px solid var(--border-default);
    box-shadow: var(--shadow-md);
}

/* ── Phones ──────────────────────────────────────────────── */
@media (max-width: 480px) {
    .header { padding: 6px 8px; gap: 6px; }
    .back-btn { padding: 6px 8px; }
    .back-label { display: none; }
    .server-title { font-size: 13px; }
    .status-label { display: none; }
    .terminal-window { padding: 4px; }
    .touch-bar .key { min-width: 40px; height: 36px; padding: 0 8px; font-size: 12px; }
    .status-overlay { font-size: 13px; padding: 10px 16px; }
}
</style>
