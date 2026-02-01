import * as React from "react";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Transaction, TxAccReq } from "@/lib/def";
import { STORAGE_KEYS } from "@/lib/config";

interface TxContextType {
  activeTransaction?: Transaction;
  requestedTransaction?: Transaction;
  errorMsg?: string
  selectedFiles?: File[];
  selectedTargets?: Array<{ publicKey: string; username: string }>;
  startTransaction?: () => void;
  clearRequest?: () => void;
  clearActive?: () => void;
  SetTransactionFromReq?: () => void;
  setSelectedFiles?: (files: File[]) => void;
  setSelectedTargets?: (targets: Array<{ publicKey: string; username: string }>) => void;
  resetAllState?: () => void;
}

const TransactionContext = React.createContext<TxContextType | null>(null);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [activeTransaction, setActiveTransaction] = React.useState<Transaction>();
  const [requestedTransaction, setRequestedTransaction] = React.useState<Transaction>();
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [selectedTargets, setSelectedTargets] = React.useState<Array<{ publicKey: string; username: string }>>([]);
  const hasCleanedOnMount = React.useRef(false);

  React.useEffect(() => {
    // On mount, check if there was a stale transaction and clean it up
    // This handles the case where user refreshes while modal is open
    if (!hasCleanedOnMount.current) {
      hasCleanedOnMount.current = true;

      const cleanupStaleTransaction = async () => {
        // Wait for websocket to connect
        await gopherSocket.waitUntilConnected();

        // Check localStorage for any saved transaction
        const savedTxReq = localStorage.getItem(STORAGE_KEYS.TRANSACTION_REQ);
        if (savedTxReq) {
          try {
            const tx = JSON.parse(savedTxReq);
            if (tx && tx.id) {
              console.log('Cleaning up stale transaction from refresh:', tx.id);
              gopherSocket.send(WSTypes.DELETE_TRANSACTION, tx.id);
            }
          } catch (e) {
            console.error('Error parsing saved transaction:', e);
          }
          localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
        }
      };

      cleanupStaleTransaction();
    }
  }, []);

  React.useEffect(() => {
    const onNewTransaction = (tx: Transaction) => {
      console.log('NEW_TRANSACTION received:', tx);
      setActiveTransaction(tx);
    };

    const onTransactionInfo = (data: Transaction) => {
      if (data !== undefined) {
        console.log('INFO_TRANSACTION received:', data);
        setActiveTransaction(data);
      }
    }

    const onReqGet = (data: TxAccReq) => {
      console.log('TRANSACTION_SHARE_ACCEPT received:', data);
      if (!requestedTransaction) {
        setRequestedTransaction(data.transaction);
        localStorage.setItem(STORAGE_KEYS.TRANSACTION_REQ, JSON.stringify(data.transaction));
      } else {
        setErrorMsg("Already in transaction wont get new invite");
        console.error(errorMsg);
      }
    };

    gopherSocket.on(WSTypes.NEW_TRANSACTION, onNewTransaction);
    gopherSocket.on(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);
    gopherSocket.on(WSTypes.INFO_TRANSACTION, onTransactionInfo);

    return () => {
      gopherSocket.off(WSTypes.NEW_TRANSACTION, onNewTransaction);
      gopherSocket.off(WSTypes.TRANSACTION_SHARE_ACCEPT, onReqGet);
      gopherSocket.off(WSTypes.INFO_TRANSACTION, onTransactionInfo);
    };
  }, [requestedTransaction, errorMsg]);

  const startTransaction = () => {
    console.log('Starting new transaction...');
    gopherSocket.send(WSTypes.NEW_TRANSACTION, null);
  };

  const clearRequest = () => {
    console.log('Clearing requested transaction');
    setRequestedTransaction(undefined);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
  };

  const clearActive = () => {
    console.log('Clearing active transaction');
    setActiveTransaction(undefined);
  };

  const SetTransactionFromReq = () => {
    console.log('Setting active transaction from request');
    setActiveTransaction(requestedTransaction);
    clearRequest();
  };

  const resetAllState = () => {
    console.log('Resetting all state');
    if (activeTransaction) {
      console.log('Sending DELETE for active transaction:', activeTransaction.id);
      gopherSocket.send(WSTypes.DELETE_TRANSACTION, activeTransaction.id);
    }
    if (requestedTransaction) {
      console.log('Sending DELETE for requested transaction:', requestedTransaction.id);
      gopherSocket.send(WSTypes.DELETE_TRANSACTION, requestedTransaction.id);
    }
    setActiveTransaction(undefined);
    setRequestedTransaction(undefined);
    setErrorMsg("");
    setSelectedFiles([]);
    setSelectedTargets([]);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTION_REQ);
  };

  return (
    <TransactionContext.Provider value={{
      activeTransaction,
      errorMsg,
      requestedTransaction,
      selectedFiles,
      selectedTargets,
      startTransaction,
      clearRequest,
      clearActive,
      SetTransactionFromReq,
      setSelectedFiles,
      setSelectedTargets,
      resetAllState
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = React.useContext(TransactionContext);
  if (!ctx) throw new Error("useTransaction must be inside TransactionProvider");
  return ctx;
}
