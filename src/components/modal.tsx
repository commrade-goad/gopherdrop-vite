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

//TODO: the timer use effect stuff so the user know how many secs left unitl auto continue
export function Modal() {
  const [openModal, SetOpenModal] = React.useState<boolean>(false);
  const { activeTransaction } = useTransaction();
  const autoContinueRef = React.useRef<number | null>(null);
  const myPublicKey = getPublicKey();

  const handleContinue = () => {
    if (autoContinueRef.current) {
      clearTimeout(autoContinueRef.current);
      autoContinueRef.current = null;
    }

    SetOpenModal(false);

    // TODO: trigger your "start transfer" logic
  };


  const decideTitle = () => {
    if (activeTransaction?.sender.user.public_key == myPublicKey && !activeTransaction?.started) {
      return "Proceed with the transfer?";
    }
    return "Waiting for the sender...";
  }
  const decideDesc = () => {
    if (activeTransaction?.sender.user.public_key == myPublicKey && !activeTransaction?.started) {
      return "You can wait for the receiver to accept the request.";
    }
    return "";
  };
  const renderButton = () => {
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
                {activeTransaction?.files !== null ? activeTransaction?.files.map((v) => (
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
                )) : ""}
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
