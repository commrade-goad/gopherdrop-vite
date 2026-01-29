import * as React from "react";
import { Dashboard } from "@/components/dashboard";
import { Setting } from "@/components/setting";
import { initAuth } from "@/lib/auth";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Loader2 } from "lucide-react";

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

        const handleUserShareList = (devices: unknown[]) => {
            console.log("Devices:", devices);
            // TODO: updateDeviceList(devices);
        };

        gopherSocket.on(WSTypes.USER_SHARE_LIST, handleUserShareList);

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

    if (activePage === "settings") {
        return <Setting onNavigate={navigate} />;
    }

    return <Dashboard onNavigate={navigate} />;
}

export default App;
