import * as React from "react";
import { FileIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useTransaction } from "@/context/TransactionContext";
import { gopherSocket, WSTypes } from "@/lib/ws";

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
    <AlertDialog open={acceptanceDialog}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold text-primary/100 break-words pr-2">
            {`"${requestedTransaction?.sender.user.username}" want to send you ${requestedTransaction?.files.length} file${ (requestedTransaction?.files && requestedTransaction?.files.length > 1) ? "s" : ""}`}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex items-start gap-4">
          <div
            className="
            flex flex-col gap-1 flex-1
            max-h-[12.5rem]
            overflow-y-auto
            pr-2
    "
          >
            {requestedTransaction?.files.map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between gap-2 min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center shrink-0">
                    <FileIcon className="h-5 w-5 text-background/100" />
                  </div>

                  <p className="font-semibold text-md truncate min-w-0">
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

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction onClick={() => { AcceptRequest(false) }}
            className="p-5 bg-muted text-foreground hover:bg-muted/80 w-full sm:w-auto"
          >Decline</AlertDialogAction>
          <AlertDialogAction onClick={() => { AcceptRequest(true) }}
            autoFocus
            className="p-5 w-full sm:w-auto"
          >Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
