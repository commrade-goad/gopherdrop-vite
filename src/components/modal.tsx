// group            not implemented
// save and load    not implemented
// recv didnt work  idk i give up. (but we got the msg at TransactionContext.tsx:75) (in the future if we need it)

import * as React from "react";
import { FileIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicKey } from "@/lib/helper";
import { useTransaction } from "@/context/TransactionContext";
import { WebRTCManager, FileTransferProgress } from "@/lib/webrtc";
import { gopherSocket, WSTypes } from "@/lib/ws";

// Custom Modal Component with proper sizing
function CustomModal({
  isOpen,
  children
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Modal Container with proper sizing */}
      <div className="relative z-50 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] flex flex-col bg-background rounded-lg shadow-lg">
        {children}
      </div>
    </div>
  );
}

export function Modal() {
  const [openModal, SetOpenModal] = React.useState<boolean>(false);
  const { activeTransaction, selectedFiles, selectedTargets, resetAllState } = useTransaction();
  const myPublicKey = getPublicKey() || "";
  const webrtcManagerRef = React.useRef<WebRTCManager | null>(null);
  const [transferProgress, setTransferProgress] = React.useState<Map<string, FileTransferProgress>>(new Map());
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [allFilesComplete, setAllFilesComplete] = React.useState(false);
  const [connectionFailed, setConnectionFailed] = React.useState(false);
  const hasInitializedWebRTC = React.useRef(false);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Track transfer stats
  const [transferSpeed, setTransferSpeed] = React.useState<number>(0);
  const [timeRemaining, setTimeRemaining] = React.useState<string>("Calculating...");
  const startTimeRef = React.useRef<number>(0);
  const lastBytesRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);

  // Track target statuses for continue button validation
  const [canContinue, setCanContinue] = React.useState(true);

  // Use refs to access latest state in interval without restarting it
  const activeTransactionRef = React.useRef(activeTransaction);
  const isTransferringRef = React.useRef(isTransferring);

  // Keep refs in sync
  React.useEffect(() => {
    activeTransactionRef.current = activeTransaction;
  }, [activeTransaction]);

  React.useEffect(() => {
    isTransferringRef.current = isTransferring;
  }, [isTransferring]);

  const startFileTransfer = React.useCallback(async () => {
    if (!activeTransaction) return;

    const isSender = activeTransaction.sender.user.public_key === myPublicKey;

    if (isSender) {
      console.log('Sender starting file transfer for transaction:', activeTransaction.id);
      // Sender: Start transaction and initiate WebRTC
      gopherSocket.send(WSTypes.START_TRANSACTION, {
        transaction_id: activeTransaction.id,
      });
    }
  }, [activeTransaction, myPublicKey]);

  const handleContinue = React.useCallback(() => {
    console.log('Continue button clicked');
    startFileTransfer();
  }, [startFileTransfer]);

  // Poll transaction info when waiting
  React.useEffect(() => {
    if (!activeTransaction) return;

    const isWaitingToStart = !activeTransaction.started && !isTransferring;

    if (isWaitingToStart) {
      // Clear any existing interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Start polling
      pollIntervalRef.current = setInterval(() => {
        const currentTx = activeTransactionRef.current;
        const currentTransferring = isTransferringRef.current;

        if (!currentTx || currentTransferring) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }

        console.log('Polling transaction info for:', currentTx.id);
        gopherSocket.send(WSTypes.INFO_TRANSACTION, currentTx.id);
      }, 2000); // Poll every 2 seconds

      // Listen for transaction deletion
      const handleTransactionDeleted = (data: unknown) => {
        console.log('DELETE_TRANSACTION received:', data);
        if (typeof data === 'string' && data === activeTransaction.id) {
          console.log('Transaction was deleted by other party');
          handleCancelCleanupOnly();
        }
      };

      gopherSocket.on(WSTypes.DELETE_TRANSACTION, handleTransactionDeleted);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        gopherSocket.off(WSTypes.DELETE_TRANSACTION, handleTransactionDeleted);
      };
    } else {
      // Stop polling if we're not waiting
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [activeTransaction, myPublicKey, isTransferring]);

  // Listen for START_TRANSACTION message to initialize WebRTC
  React.useEffect(() => {
    const handleStartTransaction = (data: {
      transaction_id?: string;
      sender?: string;
      files?: unknown[];
    }) => {
      if (!activeTransaction) return;
      if (hasInitializedWebRTC.current) return;

      console.log('START_TRANSACTION message received:', data);

      const isSender = activeTransaction.sender.user.public_key === myPublicKey;

      if (isSender) {
        // Sender: Initialize WebRTC as initiator to all selected targets
        if (!selectedFiles || selectedFiles.length === 0) {
          console.error("No files selected");
          return;
        }

        if (!selectedTargets || selectedTargets.length === 0) {
          console.error("No targets selected");
          return;
        }

        console.log('Initializing WebRTC as sender');
        hasInitializedWebRTC.current = true;
        setIsTransferring(true);
        setConnectionFailed(false);
        startTimeRef.current = Date.now();
        lastTimeRef.current = Date.now();
        lastBytesRef.current = 0;

        const manager = new WebRTCManager(
          activeTransaction.id,
          selectedFiles,
          myPublicKey,
          {
            onProgress: (progress) => {
              setTransferProgress((prev) => {
                const next = new Map(prev);
                next.set(`${progress.targetKey}-${progress.fileName}`, progress);
                return next;
              });
            },
            onComplete: (targetKey, fileName) => {
              console.log(`File ${fileName} sent to ${targetKey}`);
            },
            onError: (targetKey, error) => {
              console.error(`Error sending to ${targetKey}:`, error);
            },
            onAllFilesComplete: () => {
              console.log("All files sent successfully");
              setAllFilesComplete(true);
            },
            onConnectionFailed: () => {
              console.error("Connection failed after multiple attempts");
              setConnectionFailed(true);
              setIsTransferring(false);
            },
          }
        );

        webrtcManagerRef.current = manager;

        // Initialize connections to all selected targets
        // Only those who accepted will actually connect
        manager.initAsSender(selectedTargets);
      } else {
        // Receiver: Initialize WebRTC
        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          data !== null &&
          'transaction_id' in data &&
          data.transaction_id === activeTransaction.id
        ) {
          console.log('Initializing WebRTC as receiver');
          hasInitializedWebRTC.current = true;
          setIsTransferring(true);
          setConnectionFailed(false);
          startTimeRef.current = Date.now();
          lastTimeRef.current = Date.now();
          lastBytesRef.current = 0;

          const manager = new WebRTCManager(
            activeTransaction.id,
            [], // Receivers don't need files
            myPublicKey,
            {
              onProgress: (progress) => {
                setTransferProgress((prev) => {
                  const next = new Map(prev);
                  next.set(`${progress.targetKey}-${progress.fileName}`, progress);
                  return next;
                });
              },
              onComplete: (targetKey, fileName) => {
                console.log(`File ${fileName} received from ${targetKey}`);
              },
              onError: (targetKey, error) => {
                console.error(`Error receiving from ${targetKey}:`, error);
              },
              onAllFilesComplete: () => {
                console.log("All files received successfully");
                setAllFilesComplete(true);
              },
              onConnectionFailed: () => {
                console.error("Connection failed after multiple attempts");
                setConnectionFailed(true);
                setIsTransferring(false);
              },
            }
          );

          webrtcManagerRef.current = manager;

          // Initialize as receiver (non-initiator)
          const senderKey = activeTransaction.sender.user.public_key;
          if (senderKey) {
            manager.initAsReceiver(
              senderKey,
              activeTransaction.sender.user.username
            );
          }
        }
      }
    };

    gopherSocket.on(WSTypes.START_TRANSACTION, handleStartTransaction);

    return () => {
      gopherSocket.off(WSTypes.START_TRANSACTION, handleStartTransaction);
    };
  }, [activeTransaction, selectedFiles, selectedTargets, myPublicKey]);

  // Calculate transfer speed and time remaining
  React.useEffect(() => {
    if (!isTransferring) return;

    const interval = setInterval(() => {
      const progressArray = Array.from(transferProgress.values());
      if (progressArray.length === 0) return;

      const totalBytes = progressArray.reduce((sum, p) => sum + p.totalBytes, 0);
      const transferredBytes = progressArray.reduce((sum, p) => sum + p.bytesTransferred, 0);
      
      const now = Date.now();
      const timeDiff = (now - lastTimeRef.current) / 1000; // seconds
      
      if (timeDiff > 0) {
        const bytesDiff = transferredBytes - lastBytesRef.current;
        const speed = bytesDiff / timeDiff; // bytes per second
        setTransferSpeed(speed);
        
        lastBytesRef.current = transferredBytes;
        lastTimeRef.current = now;

        // Calculate time remaining
        const remainingBytes = totalBytes - transferredBytes;
        if (speed > 0 && remainingBytes > 0) {
          const secondsRemaining = remainingBytes / speed;
          if (secondsRemaining < 60) {
            setTimeRemaining(`${Math.ceil(secondsRemaining)}s`);
          } else if (secondsRemaining < 3600) {
            setTimeRemaining(`${Math.ceil(secondsRemaining / 60)}m`);
          } else {
            setTimeRemaining(`${Math.ceil(secondsRemaining / 3600)}h`);
          }
        } else if (transferredBytes >= totalBytes) {
          setTimeRemaining("Complete");
        }
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [isTransferring, transferProgress]);


  const decideTitle = () => {
    if (connectionFailed) {
      return "Connection Failed";
    }
    if (isTransferring) {
      const isSender = activeTransaction?.sender.user.public_key === myPublicKey;
      return isSender ? "Sending files..." : "Receiving files...";
    }
    if (activeTransaction?.sender.user.public_key == myPublicKey && !activeTransaction?.started) {
      return "Proceed with the transfer?";
    }
    return "Waiting for the sender...";
  }

  const decideDesc = () => {
    if (connectionFailed) {
      return "Unable to establish connection after multiple attempts. Please try again.";
    }
    if (isTransferring) {
      const progressArray = Array.from(transferProgress.values());
      if (progressArray.length > 0) {
        const avgProgress = progressArray.reduce((sum, p) => sum + p.percentage, 0) / progressArray.length;
        const speedMBps = (transferSpeed / (1024 * 1024)).toFixed(2);
        return `Progress: ${avgProgress.toFixed(1)}% • ${speedMBps} MB/s • ${timeRemaining} remaining`;
      }
      return "Establishing connection...";
    }
    if (activeTransaction?.sender.user.public_key == myPublicKey && !activeTransaction?.started) {
      return "Waiting for receivers to accept...";
    }
    return "";
  };

  const renderButton = () => {
    // Check if connection failed
    if (connectionFailed) {
      return (
        <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleFinishAndReset()}>
          Close & Try Again
        </Button>
      );
    }

    // Check if all files are complete via the allFilesComplete flag
    if (allFilesComplete) {
      return (
        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleFinishAndReset()}>
          Finish & Start New
        </Button>
      );
    }

    if (isTransferring) {
      return null;
    }

    if (activeTransaction?.sender.user.public_key == myPublicKey) {
      return (
        <Button
          className="p-5 w-full sm:w-auto"
          onClick={handleContinue}
          disabled={!canContinue}
        >
          Continue
        </Button>
      );
    }
  };

  const handleFinishAndReset = () => {
    console.log('Finish and reset clicked');

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Clean up WebRTC
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }

    // Reset all local state
    setIsTransferring(false);
    setAllFilesComplete(false);
    setConnectionFailed(false);
    setCanContinue(true);
    hasInitializedWebRTC.current = false;
    setTransferProgress(new Map());

    // Reset context state (this sends DELETE_TRANSACTION)
    if (resetAllState) {
      resetAllState();
    }

    // Close modal
    SetOpenModal(false);
  };

  const handleCancel = () => {
    console.log('Cancel button clicked');

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Clean up WebRTC if it exists
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }

    // Send DELETE_TRANSACTION if we have an active transaction
    if (activeTransaction) {
      console.log('Sending DELETE_TRANSACTION for:', activeTransaction.id);
      gopherSocket.send(WSTypes.DELETE_TRANSACTION, activeTransaction.id);
    }

    // Reset all local state
    setIsTransferring(false);
    setAllFilesComplete(false);
    setConnectionFailed(false);
    setCanContinue(true);
    hasInitializedWebRTC.current = false;
    setTransferProgress(new Map());
    setTransferSpeed(0);
    setTimeRemaining("Calculating...");
    startTimeRef.current = 0;
    lastBytesRef.current = 0;
    lastTimeRef.current = 0;

    // Reset context state (this also sends DELETE_TRANSACTION, but that's okay - duplicate won't hurt)
    if (resetAllState) {
      resetAllState();
    }

    // Close modal
    SetOpenModal(false);
  };

  // Cleanup only version (when receiving DELETE from other party)
  const handleCancelCleanupOnly = () => {
    console.log('Cleanup only (transaction deleted by other party)');

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Clean up WebRTC if it exists
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }

    // Reset all local state
    setIsTransferring(false);
    setAllFilesComplete(false);
    setConnectionFailed(false);
    setCanContinue(true);
    hasInitializedWebRTC.current = false;
    setTransferProgress(new Map());
    setTransferSpeed(0);
    setTimeRemaining("Calculating...");
    startTimeRef.current = 0;
    lastBytesRef.current = 0;
    lastTimeRef.current = 0;

    // Reset context state but DON'T send DELETE (already deleted)
    if (resetAllState) {
      resetAllState();
    }

    // Close modal
    SetOpenModal(false);
  };

  React.useEffect(() => {
    if (!activeTransaction) {
      SetOpenModal(false);
      return;
    }

    SetOpenModal(true);
  }, [activeTransaction]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      console.log('Modal unmounting, cleaning up...');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.destroy();
        webrtcManagerRef.current = null;
      }
    };
  }, []);

  return (
    <CustomModal isOpen={openModal}>
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b">
        <div className="flex-1 pr-8">
          <h2 className="text-lg font-bold text-primary break-words">
            {decideTitle()}
          </h2>
          <p className="text-sm text-muted-foreground break-words mt-1.5">
            {decideDesc()}
          </p>
        </div>
        {!isTransferring && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-2">
          {activeTransaction?.files !== null ? activeTransaction?.files.map((v) => {
            // Find progress for this file
            const fileProgress = Array.from(transferProgress.values()).find(
              p => p.fileName === v.name
            );

            return (
              <div
                key={v.name}
                className="flex items-center justify-between gap-2 min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-full h-10 w-10 bg-primary flex items-center justify-center shrink-0">
                    <FileIcon className="h-5 w-5 text-background" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {v.name}
                    </p>
                    {fileProgress && (
                      <div className="w-full bg-muted h-1 rounded-full mt-1">
                        <div
                          className="bg-primary h-1 rounded-full transition-all"
                          style={{ width: `${fileProgress.percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                  {fileProgress
                    ? `${fileProgress.percentage.toFixed(0)}%`
                    : `${(v.size / (1024 * 1024)).toFixed(2)} MB`
                  }
                </span>
              </div>
            );
          }) : ""}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t">
        <div className="flex flex-col sm:flex-row gap-2">
          {renderButton()}
        </div>
      </div>
    </CustomModal>
  );
}
