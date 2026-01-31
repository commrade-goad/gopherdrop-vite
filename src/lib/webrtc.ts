import SimplePeer from "simple-peer";
import { gopherSocket, WSTypes } from "./ws";

const CHUNK_SIZE = 16384; // 16KB chunks

export interface FileTransferProgress {
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  targetKey: string;
}

export interface WebRTCManagerCallbacks {
  onProgress?: (progress: FileTransferProgress) => void;
  onComplete?: (targetKey: string, fileName: string) => void;
  onError?: (targetKey: string, error: Error) => void;
}

interface PeerConnection {
  peer: SimplePeer.Instance;
  targetKey: string;
  username: string;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private transactionId: string;
  private files: File[];
  private callbacks: WebRTCManagerCallbacks;

  constructor(
    transactionId: string,
    files: File[],
    myPublicKey: string,
    callbacks: WebRTCManagerCallbacks = {}
  ) {
    this.transactionId = transactionId;
    this.files = files;
    this.callbacks = callbacks;
    // myPublicKey is available for future use if needed
    console.log('WebRTC Manager initialized for', myPublicKey);
  }

  /**
   * Initialize peer connections as the sender (initiator)
   */
  async initAsSender(targets: Array<{ publicKey: string; username: string }>) {
    for (const target of targets) {
      this.createPeer(target.publicKey, target.username, true);
    }

    // Listen for WebRTC signals from receivers
    this.setupSignalListener();
  }

  /**
   * Initialize peer connection as a receiver
   */
  async initAsReceiver(senderKey: string, senderUsername: string) {
    this.createPeer(senderKey, senderUsername, false);
    this.setupSignalListener();
  }

  /**
   * Create a peer connection
   */
  private createPeer(targetKey: string, username: string, initiator: boolean) {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
    });

    this.peers.set(targetKey, { peer, targetKey, username });

    // Handle signaling
    peer.on("signal", (signal) => {
      gopherSocket.send(WSTypes.WEBRTC_SIGNAL, {
        transaction_id: this.transactionId,
        target_key: targetKey,
        data: signal,
      });
    });

    // Handle connection establishment
    peer.on("connect", () => {
      console.log(`WebRTC connected to ${username} (${targetKey})`);
      
      // If we're the sender and connected, start sending files
      if (initiator) {
        this.sendFiles(targetKey);
      }
    });

    // Handle incoming data (for receivers)
    if (!initiator) {
      this.setupReceiver(peer, targetKey);
    }

    // Handle errors
    peer.on("error", (err) => {
      console.error(`WebRTC error with ${username}:`, err);
      this.callbacks.onError?.(targetKey, err);
    });

    // Handle close
    peer.on("close", () => {
      console.log(`WebRTC connection closed with ${username}`);
      this.peers.delete(targetKey);
    });
  }

  /**
   * Setup signal listener for incoming WebRTC signals
   */
  private setupSignalListener() {
    const handleSignal = (data: {
      transaction_id: string;
      from_key: string;
      data: SimplePeer.SignalData;
    }) => {
      if (data.transaction_id !== this.transactionId) return;

      const peerConn = this.peers.get(data.from_key);
      if (peerConn) {
        peerConn.peer.signal(data.data);
      }
    };

    gopherSocket.on(WSTypes.WEBRTC_SIGNAL, handleSignal);
  }

  /**
   * Send files to a specific peer
   */
  private async sendFiles(targetKey: string) {
    const peerConn = this.peers.get(targetKey);
    if (!peerConn) return;

    const { peer } = peerConn;

    for (const file of this.files) {
      // Send file metadata first
      const metadata = {
        type: "file-metadata",
        name: file.name,
        size: file.size,
        fileType: file.type,
      };
      peer.send(JSON.stringify(metadata));

      // Wait a bit for metadata to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send file in chunks
      let offset = 0;
      const totalBytes = file.size;

      while (offset < totalBytes) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await chunk.arrayBuffer();
        
        peer.send(arrayBuffer);

        offset += CHUNK_SIZE;

        // Report progress
        this.callbacks.onProgress?.({
          fileName: file.name,
          bytesTransferred: Math.min(offset, totalBytes),
          totalBytes,
          percentage: Math.min((offset / totalBytes) * 100, 100),
          targetKey,
        });

        // Small delay to prevent overwhelming the connection
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      // Send end-of-file marker
      peer.send(JSON.stringify({ type: "file-end", name: file.name }));

      this.callbacks.onComplete?.(targetKey, file.name);
    }

    // Send all-files-complete marker
    peer.send(JSON.stringify({ type: "all-files-complete" }));
  }

  /**
   * Setup receiver logic for incoming files
   */
  private setupReceiver(peer: SimplePeer.Instance, senderKey: string) {
    let currentFile: {
      name: string;
      size: number;
      type: string;
      chunks: ArrayBuffer[];
      bytesReceived: number;
    } | null = null;

    peer.on("data", (data) => {
      // Try to parse as JSON (metadata or control message)
      if (typeof data === "string" || data instanceof Uint8Array) {
        try {
          const text = typeof data === "string" ? data : new TextDecoder().decode(data);
          const message = JSON.parse(text);

          if (message.type === "file-metadata") {
            // Start receiving a new file
            currentFile = {
              name: message.name,
              size: message.size,
              type: message.fileType,
              chunks: [],
              bytesReceived: 0,
            };
          } else if (message.type === "file-end" && currentFile) {
            // File transfer complete, save it
            this.saveReceivedFile(currentFile);
            this.callbacks.onComplete?.(senderKey, currentFile.name);
            currentFile = null;
          } else if (message.type === "all-files-complete") {
            console.log("All files received from", senderKey);
          }
        } catch (e) {
          // Not JSON, treat as file chunk
          if (currentFile && data instanceof ArrayBuffer) {
            currentFile.chunks.push(data);
            currentFile.bytesReceived += data.byteLength;

            this.callbacks.onProgress?.({
              fileName: currentFile.name,
              bytesTransferred: currentFile.bytesReceived,
              totalBytes: currentFile.size,
              percentage: (currentFile.bytesReceived / currentFile.size) * 100,
              targetKey: senderKey,
            });
          }
        }
      } else if (data instanceof ArrayBuffer) {
        // Binary data chunk
        if (currentFile) {
          currentFile.chunks.push(data);
          currentFile.bytesReceived += data.byteLength;

          this.callbacks.onProgress?.({
            fileName: currentFile.name,
            bytesTransferred: currentFile.bytesReceived,
            totalBytes: currentFile.size,
            percentage: (currentFile.bytesReceived / currentFile.size) * 100,
            targetKey: senderKey,
          });
        }
      }
    });
  }

  /**
   * Save received file to disk
   */
  private saveReceivedFile(file: {
    name: string;
    size: number;
    type: string;
    chunks: ArrayBuffer[];
  }) {
    const blob = new Blob(file.chunks, { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Cleanup all peer connections
   */
  destroy() {
    for (const peerConn of this.peers.values()) {
      peerConn.peer.destroy();
    }
    this.peers.clear();
  }
}
