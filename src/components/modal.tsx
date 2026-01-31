import * as React from "react";
import { FileIcon, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPublicKey } from "@/lib/helper";
import { useTransaction } from "@/context/TransactionContext";
import { WebRTCManager, FileTransferProgress } from "@/lib/webrtc";
import { gopherSocket, WSTypes } from "@/lib/ws";

export function Modal() {
  const [openModal, SetOpenModal] = React.useState<boolean>(false);
  const { activeTransaction, selectedFiles, selectedTargets, resetAllState  } = useTransaction();
  const myPublicKey = getPublicKey() || "";
  const webrtcManagerRef = React.useRef<WebRTCManager | null>(null);
  const [transferProgress, setTransferProgress] = React.useState<Map<string, FileTransferProgress>>(new Map());
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [allFilesComplete, setAllFilesComplete] = React.useState(false);
  const [connectionFailed, setConnectionFailed] = React.useState(false);
  const hasInitializedWebRTC = React.useRef(false);
  const pollIntervalRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFileTransfer = React.useCallback(async () => {
    if (!activeTransaction) return;

    const isSender = activeTransaction.sender.user.public_key === myPublicKey;

    if (isSender) {
      // Sender: Start transaction and initiate WebRTC
      gopherSocket.send(WSTypes.START_TRANSACTION, {
        transaction_id: activeTransaction.id,
      });
    }
  }, [activeTransaction, myPublicKey]);

  const handleContinue = React.useCallback(() => {
    startFileTransfer();
  }, [startFileTransfer]);

  // Poll transaction info when receiver is waiting
  React.useEffect(() => {
    if (!activeTransaction) return;
    
    const isSender = activeTransaction.sender.user.public_key === myPublicKey;
    const isWaiting = !isSender && !activeTransaction.started && !isTransferring;

    if (isWaiting) {
      // Start polling for transaction info
      pollIntervalRef.current = setInterval(() => {
        gopherSocket.send(WSTypes.INFO_TRANSACTION, activeTransaction.id);
      }, 2000); // Poll every 2 seconds

      // Also set up listener for transaction deletion
      const handleTransactionDeleted = (data: unknown) => {
        if (typeof data === 'string' && data === activeTransaction.id) {
          // Transaction was deleted by sender
          handleCancel();
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

        hasInitializedWebRTC.current = true;
        setIsTransferring(true);
        setConnectionFailed(false);

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
          hasInitializedWebRTC.current = true;
          setIsTransferring(true);
          setConnectionFailed(false);

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
        return `Progress: ${avgProgress.toFixed(1)}%`;
      }
      return "Establishing connection...";
    }
    if (activeTransaction?.sender.user.public_key == myPublicKey && !activeTransaction?.started) {
      return "You can wait for the receiver to accept the request.";
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
        <Button className="p-5 w-full sm:w-auto" onClick={handleContinue}>
          Continue
        </Button>
      );
    }
  };

  const handleFinishAndReset = () => {
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
    hasInitializedWebRTC.current = false;
    setTransferProgress(new Map());
    
    // Reset context state
    if (resetAllState) resetAllState();
    
    // Close modal
    SetOpenModal(false);
  };

  const handleCancel = () => {
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

    // Delete transaction if sender
    if (activeTransaction && activeTransaction.sender.user.public_key === myPublicKey) {
      gopherSocket.send(WSTypes.DELETE_TRANSACTION, activeTransaction.id);
    }
    
    // Reset all local state
    setIsTransferring(false);
    setAllFilesComplete(false);
    setConnectionFailed(false);
    hasInitializedWebRTC.current = false;
    setTransferProgress(new Map());
    
    // Reset context state
    if (resetAllState) resetAllState();
    
    // Close modal
    SetOpenModal(false);
  };

  React.useEffect(() => {
    if (!activeTransaction) return;

    const isSender =
      activeTransaction.sender.user.public_key === myPublicKey &&
        !activeTransaction.started;

    if (!isSender) return;
    SetOpenModal(true);

    return () => {};
  }, [activeTransaction, handleContinue, myPublicKey]);


  React.useEffect(() => {
    if (activeTransaction && activeTransaction !== undefined) {
      SetOpenModal(true);
    }
    return () => {};
  }, [activeTransaction]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
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
      <Dialog open={openModal} onOpenChange={() => {}} modal={true}>
        <DialogContent 
          className="sm:max-w-lg" 
          showCloseButton={false}
        >
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-8">
                <DialogTitle className="text-lg font-bold text-primary/100 break-words">{decideTitle()}</DialogTitle>
                <DialogDescription className="break-words mt-1.5">
                  {decideDesc()}
                </DialogDescription>
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
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start gap-4">
              <div
                className="
                flex flex-col gap-1 flex-1
                max-h-[12.5rem]
                overflow-y-auto
                pr-2
    "
              >
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
                        <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center shrink-0">
                          <FileIcon className="h-5 w-5 text-background/100" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-md truncate">
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
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {renderButton()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
}
