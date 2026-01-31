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

  const AcceptRequest = (status: boolean) => {
    setAcceptanceDialog(false);
    if (status) {
      if (SetTransactionFromReq) SetTransactionFromReq();
    }
    gopherSocket.send(WSTypes.TRANSACTION_SHARE_ACCEPT, {
      transaction_id: requestedTransaction?.id,
      accept: status,
    });
    if (clearRequest) clearRequest();
  };
  const [acceptanceDialog, setAcceptanceDialog] = React.useState(false);
  React.useEffect(() => {
    if (requestedTransaction) {
      setAcceptanceDialog(true);
    }
  }, [requestedTransaction]);

  return (
    <AlertDialog open={acceptanceDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold text-primary/100">
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
                className="flex items-center justify-between"
              >
                <div className="flex flex-rowi items-center">
                  <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center shrink-0 m-3 ml-0">
                    <FileIcon className="h-5 w-5 text-background/100" />
                  </div>

                  <p className="font-semibold text-md truncate">
                    {v.name}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {(v.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={() => { AcceptRequest(false) }}
            className="p-5 bg-muted text-foreground hover:bg-muted/80"
          >Decline</AlertDialogAction>
          <AlertDialogAction onClick={() => { AcceptRequest(true) }}
            autoFocus
            className="p-5"
          >Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
