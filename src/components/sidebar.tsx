import {
  RocketIcon,
  LayoutGridIcon,
  UsersIcon,
  SettingsIcon,
  MenuIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

interface NavItemProps {
  page: string;
  icon: LucideIcon;
  label: string;
  activePage: string;
  onNavigate: (page: string) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

function NavItem({
  page,
  icon: Icon,
  label,
  activePage,
  onNavigate,
  setIsMobileMenuOpen,
}: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3",
        activePage === page
          ? "bg-accent/100 text-primary/100"
          : "text-slate-500 hover:text-slate-900",
      )}
      onClick={() => {
        onNavigate(page);
        setIsMobileMenuOpen(false);
      }}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Button>
  );
}

export function Sidebar({
  activePage,
  onNavigate,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: SidebarProps) {

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-background/100 border-r border-slate-200 flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary/100 p-2 rounded-lg">
            <RocketIcon className="h-6 w-6 text-background/100" />
          </div>
          <span className="font-bold text-xl tracking-tight">GopherDrop</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem
            page="dashboard"
            icon={LayoutGridIcon}
            label="Dashboard"
            activePage={activePage}
            onNavigate={onNavigate}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
          <NavItem
            page="groups"
            icon={UsersIcon}
            label="Groups"
            activePage={activePage}
            onNavigate={onNavigate}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
          <NavItem
            page="settings"
            icon={SettingsIcon}
            label="Settings"
            activePage={activePage}
            onNavigate={onNavigate}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
        </nav>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/100 md:hidden flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-primary/100 p-2 rounded-lg">
                <RocketIcon className="h-6 w-6 text-background/100" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                GopherDrop
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <MenuIcon className="h-6 w-6 text-slate-500" />
            </Button>
          </div>
          <nav className="flex-1 px-4 space-y-2 mt-4">
            <NavItem
              page="dashboard"
              icon={LayoutGridIcon}
              label="Dashboard"
              activePage={activePage}
              onNavigate={onNavigate}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
            <NavItem
              page="groups"
              icon={UsersIcon}
              label="Groups"
              activePage={activePage}
              onNavigate={onNavigate}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
            <NavItem
              page="settings"
              icon={SettingsIcon}
              label="Settings"
              activePage={activePage}
              onNavigate={onNavigate}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          </nav>
        </div>
      )}
    </>
  );
}
