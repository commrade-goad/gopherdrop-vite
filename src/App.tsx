import * as React from "react";
import { Dashboard } from "@/components/dashboard";
import { Setting } from "@/components/setting";
import { initAuth } from "@/lib/auth";
import { gopherSocket, WSType } from "@/lib/ws";

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
          setAuthLoading(false); // TODO: use setAuthLoading to display some spinner and stuff
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

    const handleUserShareList = (devices: unknown[]) => {
      console.log("Devices:", devices);
      // updateDeviceList(devices);
    };

    gopherSocket.on(WSType.USER_SHARE_LIST, handleUserShareList);

    return () => {
      gopherSocket.disconnect();
      // NOTE: if you add `.off()`, unregister handler here
    };
  }, [authToken]);

  if (authLoading) {
    return <div>Authenticating…</div>;
  }

  if (!authToken) {
    return <div>Authentication failed with this reason: { authError }</div>;
  }

  if (activePage === "settings") {
      return <Setting onNavigate={navigate} />;
  }

  return <Dashboard onNavigate={navigate} />;
}

export default App;
