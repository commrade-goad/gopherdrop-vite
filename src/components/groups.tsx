import * as React from "react";
import { MenuIcon, UsersIcon, TrashIcon, PlusIcon, EditIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";
import { getGroups, deleteGroup, updateGroup } from "@/lib/helper";
import { Group } from "@/lib/def";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface GroupsProps {
  onNavigate: (page: string) => void;
}

export function Groups({ onNavigate }: GroupsProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [groupToDelete, setGroupToDelete] = React.useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<Group | null>(null);
  const [editedName, setEditedName] = React.useState("");
  const [editedMembers, setEditedMembers] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

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

  const handleEditClick = (group: Group) => {
    setEditingGroup(group);
    setEditedName(group.name);
    setEditedMembers(group.members.join('\n'));
    setErrorMessage("");
    setEditDialogOpen(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete);
      loadGroups();
      setGroupToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const saveEdit = () => {
    if (!editingGroup) return;
    
    if (!editedName.trim()) {
      setErrorMessage("Group name cannot be empty");
      return;
    }

    // Parse members from textarea (one per line)
    const members = editedMembers
      .split('\n')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (members.length === 0) {
      setErrorMessage("Group must have at least one member");
      return;
    }

    const success = updateGroup(editingGroup.name, {
      name: editedName.trim(),
      members: members,
    });

    if (!success) {
      setErrorMessage(`A group named "${editedName.trim()}" already exists`);
      return;
    }

    loadGroups();
    setEditDialogOpen(false);
    setEditingGroup(null);
    setErrorMessage("");
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

                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(group);
                          }}
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(group.name);
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-primary/100">Edit Group</DialogTitle>
            <DialogDescription>
              Edit the group name and members (one public key per line)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                placeholder="Enter group name..."
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-members">Members (one public key per line)</Label>
              <textarea
                id="edit-members"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter public keys (one per line)..."
                value={editedMembers}
                onChange={(e) => setEditedMembers(e.target.value)}
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => {
                setEditDialogOpen(false);
                setEditingGroup(null);
                setErrorMessage("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveEdit}
              disabled={!editedName.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
