import * as React from "react";
import {
  WifiIcon,
  UserPlusIcon,
  SendIcon,
  RadioIcon,
  CloudIcon,
  MenuIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activePage="dashboard"
        onNavigate={onNavigate}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 md:h-24 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          </div>

          <Button
            variant="outline"
            className="rounded-full gap-2 border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
          >
            <WifiIcon className="h-4 w-4 text-cyan-500" />
            15.9 MB/s
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 bg-slate-50/50">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 md:gap-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                Nearby Devices
              </span>
              <Badge
                variant="secondary"
                className="bg-cyan-100/50 text-cyan-600 hover:bg-cyan-100 border-0 text-[10px] px-2 py-0.5 rounded-sm"
              >
                0 FOUND
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="gap-2 text-slate-500 hover:text-slate-700"
              >
                <UserPlusIcon className="h-4 w-4" />
                Save as Group
              </Button>
              <Button className="bg-cyan-400 hover:bg-cyan-500 text-white gap-2 shadow-sm shadow-cyan-200">
                <SendIcon className="h-4 w-4" />
                Send Now
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-slate-200/30 rounded-full animate-ping" />
              <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm relative z-10">
                <RadioIcon className="h-8 w-8 text-slate-300" />
              </div>
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">
              Scanning for devices...
            </h3>
            <p className="text-slate-500 text-sm">
              Ensure other devices are on the same network.
            </p>
          </div>
        </div>

        {/* Bottom Notification */}
        <Card className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 shadow-lg border-0 pl-3 pr-3">
          <CardContent className="flex items-center p-4">
            <div className="h-12 w-12 rounded-full bg-cyan-400 flex items-center justify-center mr-4 shrink-0">
              <CloudIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900">1 File(s) Restored</h4>
              <p className="text-slate-500 text-sm">
                Files restored from previous session.
              </p>
            </div>
            <Button className="bg-slate-900 text-white hover:bg-slate-800 shrink-0">
              Select Files
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
