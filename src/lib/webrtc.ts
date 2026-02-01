import { gopherSocket, WSTypes } from "./ws";

const CHUNK_SIZE = 16384; // 16KB chunks
const MAX_RECONNECT_ATTEMPTS = 2;
const RECONNECT_DELAY = 1000; // 2 seconds

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
  onAllFilesComplete?: () => void;
  onConnectionFailed?: () => void;
}

interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  targetKey: string;
  username: string;
  reconnectAttempts: number;
  connectionTimeout?: ReturnType<typeof setTimeout>;
  isSending: boolean; // Track if currently sending to avoid duplicates
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  // Track reconnect attempts separately so they persist across peer recreation
  private reconnectAttempts: Map<string, number> = new Map();
  private transactionId: string;
  private files: File[];
  private callbacks: WebRTCManagerCallbacks;
  private signalHandler: ((data: unknown) => void) | null = null;
  private completedFiles: Set<string> = new Set();
  private isDestroyed: boolean = false;

  constructor(
    transactionId: string,
    files: File[],
    _myPublicKey: string,
    callbacks: WebRTCManagerCallbacks = {}
  ) {
    this.transactionId = transactionId;
    this.files = files;
    this.callbacks = callbacks;
  }

  /**
   * Initialize peer connections as the sender (initiator)
   */
  async initAsSender(targets: Array<{ publicKey: string; username: string }>) {
    this.setupSignalListener();

    for (const target of targets) {
      // Reset reconnect count for new session
      this.reconnectAttempts.set(target.publicKey, 0);
      await this.createPeer(target.publicKey, target.username, true);
    }
  }

  /**
   * Initialize peer connection as a receiver
   */
  async initAsReceiver(senderKey: string, senderUsername: string) {
    this.setupSignalListener();
    // Reset reconnect count for new session
    this.reconnectAttempts.set(senderKey, 0);
    await this.createPeer(senderKey, senderUsername, false);
  }

  /**
   * Create a peer connection using native WebRTC APIs
   */
  private async createPeer(targetKey: string, username: string, initiator: boolean) {
    if (this.isDestroyed) return;

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(configuration);
    let dataChannel: RTCDataChannel | null = null;

    // Get existing reconnect count or default to 0
    const currentAttempts = this.reconnectAttempts.get(targetKey) || 0;

    const peerConnection: PeerConnection = {
      connection: pc,
      dataChannel: null,
      targetKey,
      username,
      reconnectAttempts: currentAttempts,
      isSending: false,
    };

    this.peers.set(targetKey, peerConnection);

    // Set connection timeout
    peerConnection.connectionTimeout = setTimeout(() => {
      if (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting') {
        this.handleConnectionFailure(targetKey, username, initiator);
      }
    }, 15000); // 15 second timeout

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && !this.isDestroyed) {
        gopherSocket.send(WSTypes.WEBRTC_SIGNAL, {
          transaction_id: this.transactionId,
          target_key: targetKey,
          data: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${username}: ${pc.connectionState}`);
      
      const peer = this.peers.get(targetKey);
      if (!peer) return;

      if (pc.connectionState === 'connected') {
        console.log(`WebRTC connected to ${username} (${targetKey})`);
        // Clear timeout on successful connection
        if (peer.connectionTimeout) {
          clearTimeout(peer.connectionTimeout);
          peer.connectionTimeout = undefined;
        }
        // Don't reset reconnect attempts on success - only reset when transfer completes successfully
      } else if (pc.connectionState === 'failed') {
        console.error(`Connection failed with ${username}`);
        this.handleConnectionFailure(targetKey, username, initiator);
      } else if (pc.connectionState === 'disconnected') {
        console.warn(`Connection disconnected with ${username}`);
        // Try to reconnect
        this.handleConnectionFailure(targetKey, username, initiator);
      }
    };

    // ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${username}: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === 'failed') {
        console.error(`ICE connection failed with ${username}`);
        this.handleConnectionFailure(targetKey, username, initiator);
      }
    };

    if (initiator) {
      // Sender creates data channel
      dataChannel = pc.createDataChannel('fileTransfer', {
        ordered: true,
      });

      this.setupDataChannel(dataChannel, targetKey, username, true);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      gopherSocket.send(WSTypes.WEBRTC_SIGNAL, {
        transaction_id: this.transactionId,
        target_key: targetKey,
        data: { type: 'offer', sdp: offer.sdp },
      });
    } else {
      // Receiver waits for data channel
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        this.setupDataChannel(dataChannel, targetKey, username, false);
      };
    }

    // Update peer with data channel
    const peer = this.peers.get(targetKey);
    if (peer) {
      peer.dataChannel = dataChannel;
    }
  }

  /**
   * Handle connection failure and retry logic
   */
  private async handleConnectionFailure(targetKey: string, username: string, initiator: boolean) {
    if (this.isDestroyed) return;

    const peer = this.peers.get(targetKey);
    if (!peer) return;

    // Clear existing timeout
    if (peer.connectionTimeout) {
      clearTimeout(peer.connectionTimeout);
      peer.connectionTimeout = undefined;
    }

    // Increment reconnect attempts in the persistent map
    const currentAttempts = (this.reconnectAttempts.get(targetKey) || 0) + 1;
    this.reconnectAttempts.set(targetKey, currentAttempts);

    console.log(`Connection attempt ${currentAttempts}/${MAX_RECONNECT_ATTEMPTS} failed for ${username}`);

    if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`Max reconnection attempts reached for ${username}. Giving up.`);
      
      // Close the failed connection
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      peer.connection.close();
      this.peers.delete(targetKey);

      // Notify about the error
      this.callbacks.onError?.(
        targetKey,
        new Error(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`)
      );

      // If all peers have failed, trigger connection failed callback
      if (this.peers.size === 0) {
        console.error('All connections failed. Triggering cleanup.');
        this.callbacks.onConnectionFailed?.();
      }
    } else {
      // Retry connection
      console.log(`Retrying connection to ${username} in ${RECONNECT_DELAY}ms...`);
      
      // Close the old connection
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      peer.connection.close();
      this.peers.delete(targetKey);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

      // Attempt to reconnect
      if (!this.isDestroyed) {
        await this.createPeer(targetKey, username, initiator);
      }
    }
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(
    channel: RTCDataChannel,
    targetKey: string,
    username: string,
    isSender: boolean
  ) {
    channel.onopen = () => {
      console.log(`Data channel opened with ${username}`);

      // Update peer connection
      const peer = this.peers.get(targetKey);
      if (peer) {
        peer.dataChannel = channel;
        // Clear timeout on successful data channel open
        if (peer.connectionTimeout) {
          clearTimeout(peer.connectionTimeout);
          peer.connectionTimeout = undefined;
        }
      }

      // If sender, start sending files from zero
      if (isSender) {
        this.sendFiles(targetKey);
      }
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${username}:`, error);
      const errorMsg = error instanceof ErrorEvent ? error.message : 'Data channel error';
      this.callbacks.onError?.(targetKey, new Error(errorMsg));
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${username}`);
      const peer = this.peers.get(targetKey);
      if (peer?.connectionTimeout) {
        clearTimeout(peer.connectionTimeout);
      }
      // Don't delete peer here - let the connection state handler manage cleanup
      // so we can distinguish between close-for-retry vs close-for-good
    };

    // Setup receiver
    if (!isSender) {
      this.setupReceiver(channel, targetKey);
    }
  }

  /**
   * Setup signal listener for incoming WebRTC signals
   */
  private setupSignalListener() {
    if (this.signalHandler) return; // Already setup

    this.signalHandler = async (data: unknown) => {
      if (this.isDestroyed) return;

      if (
        !data ||
        typeof data !== 'object' ||
        !('transaction_id' in data) ||
        !('from_key' in data) ||
        !('data' in data)
      ) {
        return;
      }

      const signalData = data as {
        transaction_id: string;
        from_key: string;
        data: {
          type: string;
          sdp?: string;
          candidate?: RTCIceCandidateInit;
        };
      };

      if (signalData.transaction_id !== this.transactionId) return;

      const peerConn = this.peers.get(signalData.from_key);
      if (!peerConn) return;

      const { connection } = peerConn;
      const signal = signalData.data;

      try {
        if (signal.type === 'offer') {
          if (!signal.sdp) {
            throw new Error('Offer missing SDP');
          }

          await connection.setRemoteDescription({
            type: 'offer',
            sdp: signal.sdp,
          });

          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);

          gopherSocket.send(WSTypes.WEBRTC_SIGNAL, {
            transaction_id: this.transactionId,
            target_key: signalData.from_key,
            data: { type: 'answer', sdp: answer.sdp },
          });
        } else if (signal.type === 'answer') {
          if (!signal.sdp) {
            throw new Error('Answer missing SDP');
          }

          await connection.setRemoteDescription({
            type: 'answer',
            sdp: signal.sdp,
          });
        } else if (signal.type === 'candidate' && signal.candidate) {
          await connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (error) {
        console.error('Error handling signal:', error);
        this.callbacks.onError?.(signalData.from_key, error as Error);
      }
    };

    gopherSocket.on(WSTypes.WEBRTC_SIGNAL, this.signalHandler);
  }

  /**
   * Send files to a specific peer (restarts from zero on reconnection)
   */
  private async sendFiles(targetKey: string) {
    if (this.isDestroyed) return;

    const peerConn = this.peers.get(targetKey);
    if (!peerConn || !peerConn.dataChannel) return;

    // Prevent duplicate sends if already sending
    if (peerConn.isSending) {
      console.log(`Already sending files to ${targetKey}, skipping duplicate send`);
      return;
    }

    peerConn.isSending = true;

    try {
      for (const file of this.files) {
        if (this.isDestroyed) break;

        // Check if data channel is still open before sending
        if (peerConn.dataChannel.readyState !== 'open') {
          console.log(`Data channel not open, stopping file transfer for ${targetKey}`);
          break;
        }

        // Send file metadata first
        const metadata = {
          type: "file-metadata",
          name: file.name,
          size: file.size,
          fileType: file.type,
        };
        peerConn.dataChannel.send(JSON.stringify(metadata));

        // Wait a bit for metadata to be processed
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Send file in chunks
        let offset = 0;
        const totalBytes = file.size;

        while (offset < totalBytes && !this.isDestroyed) {
          // Check if still connected before each chunk
          if (!this.peers.has(targetKey) || 
              !peerConn.dataChannel || 
              peerConn.dataChannel.readyState !== 'open') {
            console.log(`Connection lost during file send to ${targetKey}, aborting`);
            return; // Exit completely, will restart from zero when reconnected
          }

          const chunk = file.slice(offset, offset + CHUNK_SIZE);
          const arrayBuffer = await chunk.arrayBuffer();

          peerConn.dataChannel.send(arrayBuffer);

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

        if (this.isDestroyed) break;

        // Check connection before sending EOF marker
        if (!peerConn.dataChannel || peerConn.dataChannel.readyState !== 'open') {
          console.log(`Connection lost before EOF to ${targetKey}`);
          return;
        }

        // Send end-of-file marker
        peerConn.dataChannel.send(JSON.stringify({ type: "file-end", name: file.name }));

        this.callbacks.onComplete?.(targetKey, file.name);
      }

      if (this.isDestroyed) return;

      // Check connection before sending all-complete marker
      if (peerConn.dataChannel && peerConn.dataChannel.readyState === 'open') {
        // Send all-files-complete marker
        peerConn.dataChannel.send(JSON.stringify({ type: "all-files-complete" }));

        // Notify that all files are complete
        this.callbacks.onAllFilesComplete?.();
        
        // Reset reconnect attempts on successful completion
        this.reconnectAttempts.set(targetKey, 0);
      }
    } finally {
      // Always reset sending flag when done (successfully or due to error/disconnect)
      if (this.peers.has(targetKey)) {
        this.peers.get(targetKey)!.isSending = false;
      }
    }
  }

  /**
   * Setup receiver logic for incoming files (resets state on new connection)
   */
  private setupReceiver(channel: RTCDataChannel, senderKey: string) {
    // Reset state for this connection - start fresh from zero
    let currentFile: {
      name: string;
      size: number;
      type: string;
      chunks: ArrayBuffer[];
      bytesReceived: number;
    } | null = null;

    console.log(`Receiver ready for ${senderKey} - starting from file zero`);

    channel.onmessage = (event) => {
      if (this.isDestroyed) return;

      const data = event.data;

      // Check if it's a string (might be JSON)
      if (typeof data === "string") {
        try {
          const message = JSON.parse(data);

          if (message.type === "file-metadata") {
            // Reset current file when receiving new metadata (start from zero)
            currentFile = {
              name: message.name,
              size: message.size,
              type: message.fileType,
              chunks: [],
              bytesReceived: 0,
            };
            console.log(`Starting receive of ${message.name} from ${senderKey}`);
          } else if (message.type === "file-end" && currentFile) {
            this.saveReceivedFile(currentFile);
            this.completedFiles.add(currentFile.name);
            this.callbacks.onComplete?.(senderKey, currentFile.name);
            currentFile = null;
          } else if (message.type === "all-files-complete") {
            console.log("All files received from", senderKey);
            // Notify that all files are complete
            this.callbacks.onAllFilesComplete?.();
            // Reset reconnect attempts on successful completion
            this.reconnectAttempts.set(senderKey, 0);
          }
        } catch {
          // Not JSON, shouldn't happen for string data
          console.warn("Received non-JSON string data");
        }
      } else if (data instanceof ArrayBuffer) {
        // Try to decode as text first to check for JSON
        const view = new Uint8Array(data);
        const firstChar = String.fromCharCode(view[0]);

        // If starts with '{', might be JSON
        if (firstChar === '{') {
          try {
            const text = new TextDecoder().decode(data);
            const message = JSON.parse(text);

            if (message.type === "file-metadata") {
              // Reset current file when receiving new metadata (start from zero)
              currentFile = {
                name: message.name,
                size: message.size,
                type: message.fileType,
                chunks: [],
                bytesReceived: 0,
              };
              console.log(`Starting receive of ${message.name} from ${senderKey}`);
              return;
            } else if (message.type === "file-end" && currentFile) {
              this.saveReceivedFile(currentFile);
              this.completedFiles.add(currentFile.name);
              this.callbacks.onComplete?.(senderKey, currentFile.name);
              currentFile = null;
              return;
            } else if (message.type === "all-files-complete") {
              console.log("All files received from", senderKey);
              this.callbacks.onAllFilesComplete?.();
              this.reconnectAttempts.set(senderKey, 0);
              return;
            }
          } catch {
            // Not JSON, fall through to treat as binary
          }
        }

        // Treat as binary file chunk
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
    };
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
    if (this.isDestroyed) return;

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
    this.isDestroyed = true;

    // Remove signal listener
    if (this.signalHandler) {
      gopherSocket.off(WSTypes.WEBRTC_SIGNAL, this.signalHandler);
      this.signalHandler = null;
    }

    // Close all peer connections and clear timeouts
    for (const peerConn of this.peers.values()) {
      if (peerConn.connectionTimeout) {
        clearTimeout(peerConn.connectionTimeout);
      }
      if (peerConn.dataChannel) {
        peerConn.dataChannel.close();
      }
      peerConn.connection.close();
    }
    this.peers.clear();
    this.completedFiles.clear();
    this.reconnectAttempts.clear();
  }
}
