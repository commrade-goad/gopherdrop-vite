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
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  targetKey: string;
  username: string;
}

export class WebRTCManager {
  private peers: Map<string, PeerConnection> = new Map();
  private transactionId: string;
  private files: File[];
  private callbacks: WebRTCManagerCallbacks;
  private signalHandler: ((data: unknown) => void) | null = null;

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
      await this.createPeer(target.publicKey, target.username, true);
    }
  }

  /**
   * Initialize peer connection as a receiver
   */
  async initAsReceiver(senderKey: string, senderUsername: string) {
    this.setupSignalListener();
    await this.createPeer(senderKey, senderUsername, false);
  }

  /**
   * Create a peer connection using native WebRTC APIs
   */
  private async createPeer(targetKey: string, username: string, initiator: boolean) {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(configuration);
    let dataChannel: RTCDataChannel | null = null;

    this.peers.set(targetKey, { connection: pc, dataChannel: null, targetKey, username });

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
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
      if (pc.connectionState === 'connected') {
        console.log(`WebRTC connected to ${username} (${targetKey})`);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.callbacks.onError?.(targetKey, new Error(`Connection ${pc.connectionState}`));
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
      }

      // If sender, start sending files
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
      this.peers.delete(targetKey);
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
   * Send files to a specific peer
   */
  private async sendFiles(targetKey: string) {
    const peerConn = this.peers.get(targetKey);
    if (!peerConn || !peerConn.dataChannel) return;

    const { dataChannel } = peerConn;

    for (const file of this.files) {
      // Send file metadata first
      const metadata = {
        type: "file-metadata",
        name: file.name,
        size: file.size,
        fileType: file.type,
      };
      dataChannel.send(JSON.stringify(metadata));

      // Wait a bit for metadata to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send file in chunks
      let offset = 0;
      const totalBytes = file.size;

      while (offset < totalBytes) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await chunk.arrayBuffer();
        
        dataChannel.send(arrayBuffer);

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
      dataChannel.send(JSON.stringify({ type: "file-end", name: file.name }));

      this.callbacks.onComplete?.(targetKey, file.name);
    }

    // Send all-files-complete marker
    dataChannel.send(JSON.stringify({ type: "all-files-complete" }));
  }

  /**
   * Setup receiver logic for incoming files
   */
  private setupReceiver(channel: RTCDataChannel, senderKey: string) {
    let currentFile: {
      name: string;
      size: number;
      type: string;
      chunks: ArrayBuffer[];
      bytesReceived: number;
    } | null = null;

    channel.onmessage = (event) => {
      const data = event.data;

      // Check if it's a string (might be JSON)
      if (typeof data === "string") {
        try {
          const message = JSON.parse(data);
          
          if (message.type === "file-metadata") {
            currentFile = {
              name: message.name,
              size: message.size,
              type: message.fileType,
              chunks: [],
              bytesReceived: 0,
            };
          } else if (message.type === "file-end" && currentFile) {
            this.saveReceivedFile(currentFile);
            this.callbacks.onComplete?.(senderKey, currentFile.name);
            currentFile = null;
          } else if (message.type === "all-files-complete") {
            console.log("All files received from", senderKey);
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
              currentFile = {
                name: message.name,
                size: message.size,
                type: message.fileType,
                chunks: [],
                bytesReceived: 0,
              };
              return;
            } else if (message.type === "file-end" && currentFile) {
              this.saveReceivedFile(currentFile);
              this.callbacks.onComplete?.(senderKey, currentFile.name);
              currentFile = null;
              return;
            } else if (message.type === "all-files-complete") {
              console.log("All files received from", senderKey);
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
    // Remove signal listener
    if (this.signalHandler) {
      gopherSocket.off(WSTypes.WEBRTC_SIGNAL, this.signalHandler);
      this.signalHandler = null;
    }

    // Close all peer connections
    for (const peerConn of this.peers.values()) {
      if (peerConn.dataChannel) {
        peerConn.dataChannel.close();
      }
      peerConn.connection.close();
    }
    this.peers.clear();
  }
}
