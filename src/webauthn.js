// Helpers for converting between the WebAuthn binary types and the
// base64url-encoded strings emitted/consumed by the Go backend
// (go-webauthn).

export function b64uToBuf(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}

export function bufToB64u(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// prepareCreateOptions translates the server JSON into the
// PublicKeyCredentialCreationOptions shape navigator.credentials.create
// expects (challenge + user.id + excludeCredentials.id as ArrayBuffers).
export function prepareCreateOptions(opts) {
    const o = opts.publicKey || opts;
    o.challenge = b64uToBuf(o.challenge);
    o.user.id = b64uToBuf(o.user.id);
    if (Array.isArray(o.excludeCredentials)) {
        o.excludeCredentials = o.excludeCredentials.map((c) => ({
            ...c,
            id: b64uToBuf(c.id),
        }));
    }
    return o;
}

export function prepareGetOptions(opts) {
    const o = opts.publicKey || opts;
    o.challenge = b64uToBuf(o.challenge);
    if (Array.isArray(o.allowCredentials)) {
        o.allowCredentials = o.allowCredentials.map((c) => ({
            ...c,
            id: b64uToBuf(c.id),
        }));
    }
    return o;
}

export function serializeAttestation(cred) {
    return {
        id: cred.id,
        rawId: bufToB64u(cred.rawId),
        type: cred.type,
        response: {
            attestationObject: bufToB64u(cred.response.attestationObject),
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        },
        clientExtensionResults: cred.getClientExtensionResults
            ? cred.getClientExtensionResults()
            : {},
    };
}

export function serializeAssertion(cred) {
    return {
        id: cred.id,
        rawId: bufToB64u(cred.rawId),
        type: cred.type,
        response: {
            authenticatorData: bufToB64u(cred.response.authenticatorData),
            clientDataJSON: bufToB64u(cred.response.clientDataJSON),
            signature: bufToB64u(cred.response.signature),
            userHandle: cred.response.userHandle
                ? bufToB64u(cred.response.userHandle)
                : null,
        },
        clientExtensionResults: cred.getClientExtensionResults
            ? cred.getClientExtensionResults()
            : {},
    };
}

export function isWebAuthnSupported() {
    return (
        typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.credentials !== 'undefined'
    );
}

export function guessDeviceLabel() {
    const ua = navigator.userAgent || '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'passkey';
}
