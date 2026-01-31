import * as React from "react";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Transaction, TxAccReq } from "@/lib/def";
import { STORAGE_KEYS } from "@/lib/config";

interface TxContextType {
  activeTransaction?: Transaction;
  requestedTransaction?: Transaction;
  errorMsg?: string
  selectedFiles?: File[];
  startTransaction?: () => void;
  clearRequest?: () => void;
  SetTransactionFromReq?: () => void;
  setSelectedFiles?: (files: File[]) => void;
}

const TransactionContext = React.createContext<TxContextType | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [activeTransaction, setActiveTransaction] = React.useState<Transaction>();
  const [requestedTransaction, setRequestedTransaction] = React.useState<Transaction>();
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    const onNewTransaction = (tx: Transaction) => {
      setActiveTransaction(tx);
    };

    const onTransactionInfo = (data: Transaction) => {
      if (data !== undefined) {
        setActiveTransaction(data);
      }
    }

    const onReqGet = (data: TxAccReq) => {
      if (!requestedTransaction) {
        setRequestedTransaction(data.transaction);
        localStorage.setItem(STORAGE_KEYS.TRANSACTION_REQ, JSON.stringify(data.transaction));
      } else {
        setErrorMsg("Already in transaction wont get new invite");
        console.error(errorMsg);
      }
    };

    const last = localStorage.getItem(STORAGE_KEYS.TRANSACTION_REQ);
    if (!requestedTransaction && last) {
      try {
        setRequestedTransaction(JSON.parse(last));
      } catch(_) {
        localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
    }
    gopherSocket.on(WSTypes.NEW_TRANSACTION, onNewTransaction);
    gopherSocket.on(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);
    gopherSocket.on(WSTypes.INFO_TRANSACTION, onTransactionInfo);

    return () => {
      gopherSocket.off(WSTypes.NEW_TRANSACTION, onNewTransaction);
      gopherSocket.off(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);
      gopherSocket.off(WSTypes.INFO_TRANSACTION, onTransactionInfo);
    };
  }, []);

  const startTransaction = () => {
    gopherSocket.send(WSTypes.NEW_TRANSACTION, null);
  };

  const clearRequest = () => {
    setRequestedTransaction(undefined);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
  };

  const SetTransactionFromReq = () => {
    setActiveTransaction(requestedTransaction);
    clearRequest();
  };

  return (
    <TransactionContext.Provider value={{ activeTransaction, errorMsg, requestedTransaction, selectedFiles, startTransaction, clearRequest, SetTransactionFromReq, setSelectedFiles }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = React.useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be inside TransactionProvider");
  return ctx;
}
