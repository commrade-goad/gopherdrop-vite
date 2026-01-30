import * as React from "react";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Transaction, TxAccReq } from "@/lib/def";

interface TxContextType {
  activeTransaction?: Transaction;
  requestedTransaction?: Transaction;
  errorMsg?: string
  startTransaction?: () => void;
  clearRequest?: () => void;
  SetTransactionFromReq?: () => void;
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

    const onReqGet = (data: TxAccReq) => {
      console.log("[SOMEONE REQ TX]", data);
      if (!requestedTransaction) {
        setRequestedTransaction(data.transaction);
        localStorage.setItem("gopherdrop-transaction-request", JSON.stringify(requestedTransaction));
      } else {
        setErrorMsg("Already in transaction wont get new invite");
        console.error(errorMsg);
      }
    };
    const last = localStorage.getItem("gopherdrop-transaction-request");
    if (!requestedTransaction && last) {
      setRequestedTransaction(JSON.parse(last));
    }
    gopherSocket.on(WSTypes.NEW_TRANSACTION, onNewTransaction);
    gopherSocket.on(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);

    return () => {
      gopherSocket.off(WSTypes.NEW_TRANSACTION, onNewTransaction);
      gopherSocket.off(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);
    };
  }, []);

  const startTransaction = () => {
    gopherSocket.send(WSTypes.NEW_TRANSACTION, null);
  };

  const clearRequest = () => {
    setRequestedTransaction(undefined);
    localStorage.removeItem("gopherdrop-transaction-request");
  };

  const SetTransactionFromReq = () => {
    setActiveTransaction(requestedTransaction);
    clearRequest();
  };

  return (
    <TransactionContext.Provider value={{ activeTransaction, errorMsg, requestedTransaction, startTransaction, clearRequest, SetTransactionFromReq }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = React.useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be inside TransactionProvider");
  return ctx;
}
