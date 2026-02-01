import * as React from "react";
import { MenuIcon, UsersIcon, TrashIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";
import { getGroups, deleteGroup } from "@/lib/helper";
import { Group } from "@/lib/def";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GroupsProps {
  onNavigate: (page: string) => void;
}

export function Groups({ onNavigate }: GroupsProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [groupToDelete, setGroupToDelete] = React.useState<string | null>(null);

  const loadGroups = () => {
    const loadedGroups = getGroups();
    setGroups(loadedGroups);
  };

  React.useEffect(() => {
    loadGroups();
  }, []);

  const handleDeleteClick = (groupName: string) => {
    setGroupToDelete(groupName);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete);
      loadGroups();
      setGroupToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activePage="groups"
        onNavigate={onNavigate}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <main className="flex-1 flex flex-col relative">
        <header className="h-16 md:h-24 border-b border-slate-100 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <MenuIcon className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold text-primary/100">Groups</h1>
          </div>
          <Button 
            className="gap-2 shadow-sm"
            onClick={() => onNavigate("dashboard")}
          >
            <PlusIcon className="h-4 w-4" />
            Create Group
          </Button>
        </header>

        <div className="flex-1 p-4 md:p-8 bg-slate-50/50">
          {groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <Card
                  key={group.name}
                  className="p-4 hover:bg-slate-50 transition"
                >
                  <CardContent className="p-0">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center shrink-0">
                        <UsersIcon className="h-5 w-5 text-background/100" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-md text-foreground/100 mb-1">
                          {group.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                        </p>
                        <div className="mt-2 text-xs text-slate-400">
                          {group.members.slice(0, 2).map((pubkey, idx) => (
                            <div key={idx} className="truncate">
                              {pubkey.substring(0, 16)}...
                            </div>
                          ))}
                          {group.members.length > 2 && (
                            <div className="text-slate-400">
                              +{group.members.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                        onClick={() => handleDeleteClick(group.name)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
              <div className="h-16 w-16 rounded-full bg-background/100 flex items-center justify-center shadow-sm mb-6">
                <UsersIcon className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-bold text-primary/100 text-lg mb-1">
                No Groups Yet
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                Create your first group from the Dashboard
              </p>
              <Button onClick={() => onNavigate("dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-primary/100 pb-3">
              Delete Group
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{groupToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
