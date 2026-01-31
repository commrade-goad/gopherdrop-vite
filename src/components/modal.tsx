import * as React from "react";
import { FileIcon } from "lucide-react";
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

//TODO: the timer use effect stuff so the user know how many secs left unitl auto continue
export function Modal() {
  const [openModal, SetOpenModal] = React.useState<boolean>(false);
  const { activeTransaction, selectedFiles } = useTransaction();
  const autoContinueRef = React.useRef<number | null>(null);
  const myPublicKey = getPublicKey() || "";
  const webrtcManagerRef = React.useRef<WebRTCManager | null>(null);
  const [transferProgress, setTransferProgress] = React.useState<Map<string, FileTransferProgress>>(new Map());
  const [isTransferring, setIsTransferring] = React.useState(false);
  const hasInitializedWebRTC = React.useRef(false);

  const handleContinue = () => {
    if (autoContinueRef.current) {
      clearTimeout(autoContinueRef.current);
      autoContinueRef.current = null;
    }

    SetOpenModal(false);

    // Start the WebRTC file transfer
    startFileTransfer();
  };

  const startFileTransfer = async () => {
    if (!activeTransaction) return;

    const isSender = activeTransaction.sender.user.public_key === myPublicKey;

    if (isSender) {
      // Sender: Start transaction and initiate WebRTC
      gopherSocket.send(WSTypes.START_TRANSACTION, {
        transaction_id: activeTransaction.id,
      });
    }
  };

  // Listen for START_TRANSACTION message to initialize WebRTC
  React.useEffect(() => {
    const handleStartTransaction = (data: any) => {
      if (!activeTransaction) return;
      if (hasInitializedWebRTC.current) return;

      const isSender = activeTransaction.sender.user.public_key === myPublicKey;
      
      if (isSender) {
        // Sender: Initialize WebRTC as initiator
        if (!selectedFiles || selectedFiles.length === 0) {
          console.error("No files selected");
          return;
        }

        hasInitializedWebRTC.current = true;
        setIsTransferring(true);

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
          }
        );

        webrtcManagerRef.current = manager;

        // Get target users from transaction
        // Note: The backend doesn't send target info in START_TRANSACTION for sender
        // We need to track accepted users from TRANSACTION_SHARE_ACCEPT notifications
        // For now, we'll use a workaround - wait for WebRTC signals
      } else {
        // Receiver: Initialize WebRTC
        if (typeof data === 'object' && data.transaction_id === activeTransaction.id) {
          hasInitializedWebRTC.current = true;
          setIsTransferring(true);

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
  }, [activeTransaction, selectedFiles, myPublicKey]);

  // Track accepted users for sender
  const acceptedUsers = React.useRef<Array<{ publicKey: string; username: string }>>([]);

  React.useEffect(() => {
    const handleAcceptNotification = (data: any) => {
      if (!activeTransaction) return;
      if (activeTransaction.sender.user.public_key !== myPublicKey) return;

      // Handle accept notifications
      if (data.type === 'accept_notification' && data.transaction_id === activeTransaction.id) {
        // Find user info - we'll need to get it from the user list
        // For now, we'll use the username from the notification
        acceptedUsers.current.push({
          publicKey: '', // We'll get this from WebRTC signals
          username: data.username,
        });
      }
    };

    gopherSocket.on(WSTypes.TRANSACTION_SHARE_ACCEPT, handleAcceptNotification);

    return () => {
      gopherSocket.off(WSTypes.TRANSACTION_SHARE_ACCEPT, handleAcceptNotification);
    };
  }, [activeTransaction, myPublicKey]);

  // Initialize sender WebRTC when we receive the first signal from a receiver
  React.useEffect(() => {
    const handleWebRTCSignal = (data: any) => {
      if (!activeTransaction) return;
      if (!webrtcManagerRef.current) return;

      const isSender = activeTransaction.sender.user.public_key === myPublicKey;

      if (isSender && data.transaction_id === activeTransaction.id) {
        // Sender receives signal from receiver - check if we need to initialize
        const fromKey = data.from_key;
        
        // Check if we already have a peer for this user
        // If not, create one (this means the receiver connected first)
        if (!selectedFiles || selectedFiles.length === 0) return;

        // The WebRTCManager will handle the signal via the listener it set up
        // We just need to make sure we have targets set
        const targets = acceptedUsers.current;
        
        // If we don't have targets yet, add this user
        if (targets.length === 0 || !targets.find(t => t.publicKey === fromKey)) {
          const newTarget = { publicKey: fromKey, username: 'User' };
          acceptedUsers.current.push(newTarget);
          
          // Initialize connection for this user if not already done
          webrtcManagerRef.current.initAsSender([newTarget]);
        }
      }
    };

    gopherSocket.on(WSTypes.WEBRTC_SIGNAL, handleWebRTCSignal);

    return () => {
      gopherSocket.off(WSTypes.WEBRTC_SIGNAL, handleWebRTCSignal);
    };
  }, [activeTransaction, myPublicKey, selectedFiles]);


  const decideTitle = () => {
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
    if (isTransferring) {
      return null; // No button during transfer
    }
    if (activeTransaction?.sender.user.public_key == myPublicKey) {
      return (
        <Button className="p-5" onClick={handleContinue}>
           Continue
        </Button>
      )
    }
    // NOTE: maybe still render button so the recv can cancel
  };

  React.useEffect(() => {
    if (!activeTransaction) return;

    const isSender =
      activeTransaction.sender.user.public_key === myPublicKey &&
        !activeTransaction.started;

    if (!isSender) return;

    // open modal
    SetOpenModal(true);

    // start auto-continue timer
    autoContinueRef.current = window.setTimeout(() => {
      handleContinue();
    }, 5000);

    return () => {
      if (autoContinueRef.current) {
        clearTimeout(autoContinueRef.current);
        autoContinueRef.current = null;
      }
    };
  }, [activeTransaction?.id]);


  React.useEffect(() => {
    if (activeTransaction && activeTransaction !== undefined) {
      SetOpenModal(true);
    }
    return () => {};
  }, [activeTransaction]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.destroy();
        webrtcManagerRef.current = null;
      }
    };
  }, []);

    return (
      <Dialog open={openModal} onOpenChange={SetOpenModal}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-primary/100">{decideTitle()}</DialogTitle>
            <DialogDescription>
              {decideDesc()}
            </DialogDescription>
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
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-rowi items-center flex-1">
                        <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center shrink-0 m-3 ml-0">
                          <FileIcon className="h-5 w-5 text-background/100" />
                        </div>

                        <div className="flex-1">
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
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
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

          <DialogFooter>
            {renderButton()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
}
