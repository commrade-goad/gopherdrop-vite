import * as React from "react";
import { Dashboard } from "@/components/dashboard";
import { Setting } from "@/components/setting";
import { Groups } from "@/components/groups";
import { Modal } from "@/components/modal";
import { Notification } from "@/components/notification";
import { initAuth } from "@/lib/auth";
import { gopherSocket } from "@/lib/ws";
import { Loader2 } from "lucide-react";
import { TransactionProvider } from "@/context/TransactionContext";

export function App() {
  const [activePage, setActivePage] = React.useState(() => {
    return localStorage.getItem("gopherdrop-active-page") || "dashboard";
  });

  const [authToken, setAuthToken] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const navigate = (page: string) => {
    setActivePage(page);
    localStorage.setItem("gopherdrop-active-page", page);
  };

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await initAuth();
        if (!cancelled) {
          setAuthToken(token);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError("Authentication failed");
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!authToken) return;

    gopherSocket.connect(authToken);

    return () => {
      gopherSocket.disconnect();
    };
  }, [authToken]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
                                                         Authenticating...
          </p>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return <div>Authentication failed with this reason: {authError}</div>;
  }

  return (
    <TransactionProvider>
      {activePage === "settings"
        ? <Setting onNavigate={navigate} />
        : activePage === "groups"
          ? <Groups onNavigate={navigate} />
          : <Dashboard onNavigate={navigate} />
      }
      <Notification/>
      <Modal/>
    </TransactionProvider>
  );
}

export default App;
