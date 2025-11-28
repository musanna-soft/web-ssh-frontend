import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePanelStore = defineStore('panels', () => {
    const panels = ref([]);
    const nextId = ref(1);

    const addPanel = (type, serverId, serverName, username) => {
        panels.value.push({
            id: nextId.value++,
            type, // 'terminal' or 'sftp'
            serverId,
            serverName,
            path: username === "root" ? "/root" : "/home/" + username
        });
    };

    const removePanel = (id) => {
        const index = panels.value.findIndex(p => p.id === id);
        if (index !== -1) {
            panels.value.splice(index, 1);
        }
    };

    const updatePanel = (id, data) => {
        const panel = panels.value.find(p => p.id === id);
        if (panel) {
            Object.assign(panel, data);
        }
    };

    return {
        panels,
        addPanel,
        removePanel,
        updatePanel
    };
});
