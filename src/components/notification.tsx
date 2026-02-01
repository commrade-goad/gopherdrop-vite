import * as React from "react";
import { FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransaction } from "@/context/TransactionContext";
import { gopherSocket, WSTypes } from "@/lib/ws";

// Custom Notification Modal Component
function CustomNotificationModal({
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

      {/* Modal Container */}
      <div className="relative z-50 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100vh-2rem)] flex flex-col bg-background rounded-lg shadow-lg">
        {children}
      </div>
    </div>
  );
}

export function Notification() {
  const { clearRequest, requestedTransaction, SetTransactionFromReq } = useTransaction();
  const [acceptanceDialog, setAcceptanceDialog] = React.useState(false);

  const AcceptRequest = (status: boolean) => {
    gopherSocket.send(WSTypes.TRANSACTION_SHARE_ACCEPT, {
      transaction_id: requestedTransaction?.id,
      accept: status,
    });
    if (status) {
      if (SetTransactionFromReq) SetTransactionFromReq();
    }
    if (clearRequest) clearRequest();
    setAcceptanceDialog(false);
  };

  // Show dialog whenever requestedTransaction changes
  React.useEffect(() => {
    if (requestedTransaction !== undefined) {
      setAcceptanceDialog(true);
    } else {
      setAcceptanceDialog(false);
    }
  }, [requestedTransaction]);

  return (
    <CustomNotificationModal isOpen={acceptanceDialog}>
      {/* Header */}
      <div className="p-6 border-b">
        <h2 className="font-bold text-primary break-words">
          {`"${requestedTransaction?.sender.user.username}" wants to send you ${requestedTransaction?.files.length} file${(requestedTransaction?.files && requestedTransaction?.files.length > 1) ? "s" : ""}`}
        </h2>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-2">
          {requestedTransaction?.files.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between gap-2 min-w-0"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="rounded-full h-10 w-10 bg-primary flex items-center justify-center shrink-0">
                  <FileIcon className="h-5 w-5 text-background" />
                </div>

                <p className="font-semibold text-sm truncate min-w-0">
                  {v.name}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {(v.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => { AcceptRequest(false) }}
            className="p-5 bg-muted text-foreground hover:bg-muted/80 w-full sm:w-auto"
          >
            Decline
          </Button>
          <Button
            onClick={() => { AcceptRequest(true) }}
            className="p-5 w-full sm:w-auto"
          >
            Accept
          </Button>
        </div>
      </div>
    </CustomNotificationModal>
  );
}
