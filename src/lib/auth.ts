import { API_BASE_URL, API_HEADERS, STORAGE_KEYS } from "@/lib/config"
import {
    getPrivateKey, getPublicKey,
    generateKeyPair, saveKeys, initDeviceIdentity,
    importPrivateKey, signData
} from "./helper"

const ENDPOINTS = {
    REGISTER: `${API_BASE_URL}/register`,
    CHALLENGE: `${API_BASE_URL}/challenge`,
    LOGIN: `${API_BASE_URL}/login`
};
export const initAuth = async () => {
    try {
        let privateKey = getPrivateKey();
        let publicKey = getPublicKey();

        if (!privateKey || !publicKey) {
            await performRegistration();
            privateKey = getPrivateKey();
            publicKey = getPublicKey();
            localStorage.setItem(STORAGE_KEYS.THEME, 'light');
            window.location.reload();
        } else {
            const token = await performLogin(publicKey);
            return token;
        }
    } catch (error: any) {
        console.error("[Auth Error]", error);
        if (error.message.includes("User not found") || error.message.includes("Authentication failed")) {
            // window.showToast('Credentials rejected. Restarting authentication...', 'error');
            localStorage.clear();
        }

        return null;
    }
};

const performRegistration = async () => {
    const keyPair = await generateKeyPair();
    await saveKeys(keyPair);
    await initDeviceIdentity(); // Set ID & Name

    // Send Public Key to Server
    const response = await fetch(ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
            username: crypto.randomUUID(),
            public_key: getPublicKey()
        })
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${await response.text()}`);
    }
};

const performLogin = async (publicKey: string) => {
    // Request Challenge
    const challengeRes = await fetch(ENDPOINTS.CHALLENGE, { headers: API_HEADERS });
    if (!challengeRes.ok) throw new Error('Network error: Failed to get challenge');

    const challengeJson = await challengeRes.json();
    const challengeBase64 = challengeJson.data;

    // Sign Challenge
    const privateKeyObj = await importPrivateKey();
    if (!privateKeyObj) {
        throw new Error("Failed to get private key from the local storage");
    }
    const signature = await signData(challengeBase64, privateKeyObj);

    // Verify with Server
    const loginRes = await fetch(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
            public_key: publicKey,
            challenge: challengeBase64,
            signature: signature
        })
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.message || "Authentication failed");
    }

    // Save Token
    localStorage.setItem(STORAGE_KEYS.TOKEN, loginData.data);
    return loginData.data;
}
