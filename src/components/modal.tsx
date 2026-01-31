import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTransaction } from "@/context/TransactionContext";

export function Modal() {
  const [openModal, SetOpenModal] = React.useState<boolean>(false);
  const { activeTransaction } = useTransaction();

  React.useEffect(() => {
    if (activeTransaction && activeTransaction !== undefined) {
      SetOpenModal(true);
    }
    return () => {};
  }, [activeTransaction]);
    return (
      <Dialog open={openModal} onOpenChange={SetOpenModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sending Files...</DialogTitle>
            <DialogDescription>
                                 Your transfer is being prepared — please wait.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* your custom body goes here */}
          </div>

          <DialogFooter>
            <Button onClick={() => SetOpenModal(false)}>
                                                          Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
}
