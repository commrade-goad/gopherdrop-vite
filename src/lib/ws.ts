import { API_BASE_URL } from "./config";

// ==========================================
// Types & Enums
// ==========================================

export const WSTypes = {
    NONE: 0,
    ERROR: 1,
    CONFIG_DISCOVERABLE: 2,
    START_SHARING: 3,
    USER_SHARE_LIST: 4,
    NEW_TRANSACTION: 5,
    INFO_TRANSACTION: 6,
    DELETE_TRANSACTION: 7,
    USER_SHARE_TARGET: 8,
    FILE_SHARE_TARGET: 9,
    START_TRANSACTION: 10,
    TRANSACTION_SHARE_ACCEPT: 11,
    WEBRTC_SIGNAL: 12,
    USER_INFO: 13,
    CONFIG_NAME: 14,
} as const;

export type WSType = typeof WSTypes[keyof typeof WSTypes];

export interface WSMessage<T = unknown> {
    type: WSType;
    data: T;
}

type Handler<T = unknown> = (data: T) => void;

// ==========================================
// GopherSocket Class
// ==========================================

export class GopherSocket {
    private socket: WebSocket | null = null;
    private handlers: Partial<Record<WSType, Handler[]>> = {};
    private token: string | null = null;
    private isConnected = false;

    /**
     * Connect to WebSocket server
     */
    connect(token: string): void {
        if (this.socket) {
            this.socket.close();
        }

        this.token = token;

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const url = new URL(API_BASE_URL);
        const mod_url = url.host + url.pathname.replace(/\/$/, "");
        const final = `${protocol}://${mod_url}/protected/ws?token=${token}`;

        this.socket = new WebSocket(final);

        this.socket.onopen = () => {
            this.isConnected = true;
            this.send(WSTypes.START_SHARING, null);
        };

        this.socket.onclose = () => {
            this.isConnected = false;

            // Simple reconnect
            setTimeout(() => {
                if (this.token) this.connect(this.token);
            }, 3000);
        };

        this.socket.onerror = (err) => {
            console.error("[WS Error]", err);
        };

        this.socket.onmessage = (event: MessageEvent<string>) => {
            try {
                const msg: WSMessage = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (err) {
                console.error("[WS Parse Error]", err);
            }
        };
    }

    /**
     * Send message to server
     */
    send<T>(type: WSType, data: T): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        const payload: WSMessage<T> = { type, data };
        this.socket.send(JSON.stringify(payload));
    }

    /**
     * Register message handler
     */
    on<T>(type: WSType, callback: Handler<T>): void {
        if (!this.handlers[type]) {
            this.handlers[type] = [];
        }
        this.handlers[type]!.push(callback as Handler);
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(msg: WSMessage): void {
        const typeHandlers = this.handlers[msg.type];
        if (typeHandlers) {
            typeHandlers.forEach(handler => handler(msg.data));
        }

        if (msg.type === WSTypes.ERROR) {
            console.error("[WS Server Error]", msg.data);
        }
    }

    /**
     * Optional helpers
     */
    disconnect(): void {
        this.socket?.close();
        this.socket = null;
        this.isConnected = false;
    }

    get connected(): boolean {
        return this.isConnected;
    }

    waitUntilConnected(): Promise<void> {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const check = () => {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }
}

// ==========================================
// Singleton Export
// ==========================================

export const gopherSocket = new GopherSocket();
