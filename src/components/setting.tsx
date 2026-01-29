import * as React from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";

interface SettingProps {
  onNavigate: (page: string) => void;
}

export function Setting({ onNavigate }: SettingProps) {
  const [deviceName, setDeviceName] = React.useState("Tidak ada nama");
  const [isDiscoverable, setIsDiscoverable] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleSaveJson = () => {
    const data = {
      deviceName,
      isDiscoverable,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gopherdrop-user-data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data.deviceName) setDeviceName(data.deviceName);
          if (data.isDiscoverable !== undefined)
            setIsDiscoverable(data.isDiscoverable);
        } catch (error) {
          console.error("Error parsing JSON:", error);
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activePage="settings"
        onNavigate={onNavigate}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <main className="flex-1 flex flex-col relative">
        <header className="h-16 md:h-24 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {/* MenuIcon is handled by Sidebar overlay, but we need a trigger here. 
                        Actually Sidebar handles the overlay, but we need the trigger button in the main content area.
                        We can import MenuIcon here.
                     */}
              {/* Wait, Sidebar component only renders the overlay and the desktop sidebar.
                         So we DO need the trigger button here.
                      */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </Button>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Device Settings</CardTitle>
              <CardDescription>
                Manage your device visibility and identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5 pr-2">
                  <Label className="text-base">Discoverable</Label>
                  <p className="text-sm text-slate-500">
                    Allow other devices on the network to see this device.
                  </p>
                </div>
                {/* Custom switch since we don't have one in UI components yet, using a styled button behaving like a switch for now or simple checkbox */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="discoverable"
                    checked={isDiscoverable}
                    onCheckedChange={setIsDiscoverable}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export or import your user data.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Label htmlFor="file-upload">Save User Data</Label>
              <Button className="w-full sm:w-auto" onClick={handleSaveJson}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Save User Data (JSON)
              </Button>
              <div className="flex items-center gap-4">
                <div className="flex flex-col w-full gap-1.5">
                  <Label htmlFor="file-upload" className="mb-2">
                    Load User Data
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleLoadJson}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
