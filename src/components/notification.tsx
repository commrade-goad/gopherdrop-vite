import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useTransaction } from "@/context/TransactionContext";

export function Notification() {
  const { clearRequest, requestedTransaction } = useTransaction();

  const [acceptanceDialog, setAcceptanceDialog] = React.useState(false);
  React.useEffect(() => {
    if (requestedTransaction) {
      setAcceptanceDialog(true);
      if (clearRequest) clearRequest();
    }
  }, [requestedTransaction]);

  return (
    <AlertDialog open={acceptanceDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold text-primary/100 pb-3">Failed to start transaction</AlertDialogTitle>
          <AlertDialogDescription>
                                    "accept"
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogAction onClick={() => { setAcceptanceDialog(false) }}
            className="p-5"
          >OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

}
