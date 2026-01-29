import * as React from "react";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Transaction, TxAccReq } from "@/lib/def";

interface TxContextType {
  activeTransaction?: Transaction;
  requestedTransaction?: Transaction;
  errorMsg?: string
  startTransaction?: () => void;
  clearRequest?: () => void;
}

const TransactionContext = React.createContext<TxContextType | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [activeTransaction, setActiveTransaction] = React.useState<Transaction>();
  const [requestedTransaction, setRequestedTransaction] = React.useState<Transaction>();
  const [errorMsg, setErrorMsg] = React.useState<string>("");

  React.useEffect(() => {
    const onNewTransaction = (tx: Transaction) => {
      console.log("[TX]", tx);
      setActiveTransaction(tx);
    };

    const onAccept = (data: TxAccReq) => {
      console.log("[TX ACCEPT]", data);
      if (!requestedTransaction) setRequestedTransaction(data.transaction);
      else {
        setErrorMsg("Already in transaction wont get new invite");
        console.error(errorMsg);
      }
    };

    gopherSocket.on(WSTypes.NEW_TRANSACTION, onNewTransaction);
    gopherSocket.on(WSTypes.TRANSACTION_SHARE_ACCEPT, onAccept);

    return () => {
      gopherSocket.off(WSTypes.NEW_TRANSACTION, onNewTransaction);
      gopherSocket.off(WSTypes.TRANSACTION_SHARE_ACCEPT, onAccept);
    };
  }, []);

  const startTransaction = () => {
    gopherSocket.send(WSTypes.NEW_TRANSACTION, null);
  };

  const clearRequest = () => {
    setRequestedTransaction(undefined);
  };

  return (
    <TransactionContext.Provider value={{ activeTransaction, errorMsg, requestedTransaction, startTransaction, clearRequest }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = React.useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be inside TransactionProvider");
  return ctx;
}
