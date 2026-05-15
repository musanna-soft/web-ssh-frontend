import { defineStore } from 'pinia';

// MFA status cache + cross-component signals. The auth status itself is
// authoritative on the server; this store just holds the most recent
// snapshot and a flag for "we just enrolled, here are the recovery codes".
export const useMFAStore = defineStore('mfa', {
    state: () => ({
        loaded: false,
        enrolled: false,
        active: false,
        devices: 0,
        recoveryRemaining: 0,
        mfaRequired: false,
        // One-shot: populated by the setup flow so the user sees their
        // recovery codes on the next route view. Cleared once shown.
        pendingRecoveryCodes: null,
        // Most recent grace-period deadline learned from response headers.
        graceUntil: null,
    }),
    actions: {
        applyStatus(payload) {
            this.loaded = true;
            this.enrolled = !!payload.enrolled;
            this.active = !!payload.active;
            this.devices = payload.devices || 0;
            this.recoveryRemaining = payload.recovery_remaining || 0;
            this.mfaRequired = !!payload.mfa_required;
        },
        setRecoveryCodes(codes) {
            this.pendingRecoveryCodes = codes;
        },
        consumeRecoveryCodes() {
            const codes = this.pendingRecoveryCodes;
            this.pendingRecoveryCodes = null;
            return codes;
        },
        setGraceUntil(value) {
            this.graceUntil = value || null;
        },
        reset() {
            this.loaded = false;
            this.enrolled = false;
            this.active = false;
            this.devices = 0;
            this.recoveryRemaining = 0;
            this.pendingRecoveryCodes = null;
        },
    },
});
