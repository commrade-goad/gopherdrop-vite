import * as React from "react";
import {
  MonitorSmartphone,
  UserPlusIcon,
  SendIcon,
  RadioIcon,
  FileIcon,
  Files,
  MenuIcon,
  TreePalm,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";
import { User, WeirdUserWrapper, GFile } from "@/lib/def";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicKey, addGroup, getGroups } from "@/lib/helper";
import { useTransaction } from "@/context/TransactionContext";
import { Group } from "@/lib/def";
import { UsersIcon } from "lucide-react";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { activeTransaction, startTransaction: StartTx, setSelectedFiles, setSelectedTargets } = useTransaction();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [AllDevices, setAllDevices] = React.useState<User[]>([]);
  const [selectedDevices, setSelectedDevices] = React.useState<string[]>([]);
  const [targetFile, setTargetFile] = React.useState<GFile[]>([]);
  const [errorDialog, setErrorDialog] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [errorType, setErrorType] = React.useState<"transaction" | "group">("transaction");
  const [saveGroupDialog, setSaveGroupDialog] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groups, setGroups] = React.useState<Group[]>([]);
  const txInitializedRef = React.useRef<string | null>(null);

  const pluralize = (count: number, suffix: string = 's') => count !== 1 ? suffix : '';

  const startTransaction = () => {
    if (targetFile.length <= 0 || selectedDevices.length <= 0) {
      setErrorType("transaction");
      setErrorMessage("Please select at least one file and one device.");
      setErrorDialog(true);
      return;
    }
    if (activeTransaction && activeTransaction.id.length > 0) {
      setErrorType("transaction");
      setErrorMessage("Already in active transaction.");
      setErrorDialog(true);
      return;
    }
    if (StartTx) StartTx();
  };

  const openSaveGroupDialog = () => {
    if (selectedDevices.length === 0) {
      setErrorType("group");
      setErrorMessage("Please select at least one device to create a group.");
      setErrorDialog(true);
      return;
    }
    setSaveGroupDialog(true);
  };

  const saveGroup = () => {
    if (!groupName.trim()) {
      return;
    }
    const success = addGroup({
      name: groupName.trim(),
      members: selectedDevices,
    });
    if (!success) {
      setErrorType("group");
      setErrorMessage(`A group named "${groupName.trim()}" already exists. Please choose a different name.`);
      setSaveGroupDialog(false);
      setErrorDialog(true);
      setGroupName("");
      return;
    }
    setGroupName("");
    setSaveGroupDialog(false);
    // Reload groups after successful save
    const loadedGroups = getGroups();
    setGroups(loadedGroups);
  };
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const gfiles: GFile[] = files.map((v) => ({
      name: v.name,
      size: v.size,
      type: v.type,
    }));
    setTargetFile(gfiles);
    // Store actual File objects in context
    if (setSelectedFiles) setSelectedFiles(files);
  };

  const decideIcon = () => {
    if (targetFile.length <= 0) return <TreePalm className="h-6 w-6 text-background/100" />;
    else if (targetFile.length == 1) return <FileIcon className="h-6 w-6 text-background/100" />;
    else return <Files className="h-6 w-6 text-background/100" />;
  }

  const registerMember = (public_key: string) => {
    setSelectedDevices(prev => {
      if (prev.includes(public_key)) {
        return prev.filter(k => k !== public_key);
      }
      return [...prev, public_key];
    });
  };

  const selectGroup = (group: Group) => {
    // Select all members from the group
    setSelectedDevices(group.members);
  };

  // Clear file selection when activeTransaction is cleared
  React.useEffect(() => {
    if (!activeTransaction) {
      // Reset file selection
      setTargetFile([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Reset transaction ref
      txInitializedRef.current = null;
    }
  }, [activeTransaction]);

  // Load groups from localStorage
  React.useEffect(() => {
    const loadedGroups = getGroups();
    setGroups(loadedGroups);
  }, []);

  React.useEffect(() => {
    let interval: number;
    const myPublicKey = getPublicKey();

    const deviceListHandler = (devices: WeirdUserWrapper[]) => {
      const next = devices
        .map(d => d.user)
        .filter(u => u.public_key !== myPublicKey);

      setAllDevices(prev => {
        if (prev.length === next.length &&
          prev.every((p, i) => p.public_key === next[i]?.public_key)
        ) {
          return prev;
        }
        return next;
      });
    };

    (async () => {
      await gopherSocket.waitUntilConnected();

      gopherSocket.on(WSTypes.USER_SHARE_LIST, deviceListHandler);
      gopherSocket.send(WSTypes.START_SHARING, null);

      interval = window.setInterval(() => {
        gopherSocket.send(WSTypes.START_SHARING, null);
      }, 3000);
    })();

    return () => {
      clearInterval(interval);
      gopherSocket.off(WSTypes.USER_SHARE_LIST, deviceListHandler);
    };
  }, []);

  React.useEffect(() => {
    const myPublicKey = getPublicKey();
    if (!activeTransaction) return;
    if (selectedDevices.length === 0) return;

    // already handled this transaction
    if (txInitializedRef.current === activeTransaction.id) return;

    txInitializedRef.current = activeTransaction.id;

    if (activeTransaction.sender.user.public_key === myPublicKey) {
      gopherSocket.send(WSTypes.FILE_SHARE_TARGET, {
        transaction_id: activeTransaction.id,
        files: targetFile,
      });

      gopherSocket.send(WSTypes.USER_SHARE_TARGET, {
        transaction_id: activeTransaction.id,
        public_keys: selectedDevices,
      });

      gopherSocket.send(WSTypes.INFO_TRANSACTION, activeTransaction.id);

      // Store selected targets for WebRTC
      const targets = AllDevices
        .filter(user => selectedDevices.includes(user.public_key))
        .map(user => ({
          publicKey: user.public_key,
          username: user.username,
        }));
      
      if (setSelectedTargets) {
        setSelectedTargets(targets);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTransaction?.id]);

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
            <h1 className="text-2xl font-bold text-primary/100">Dashboard</h1>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 bg-slate-50/50">
          {/* Groups Section */}
          {groups.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Saved Groups
                </span>
                <Badge
                  variant="secondary"
                  className="bg-foreground/10 text-primary/100 border-0 text-[10px] px-2 py-0.5"
                >
                  {groups.length} GROUP{pluralize(groups.length, 'S')}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {groups.map((group) => {
                  // Check if all group members are selected
                  const isSelected = group.members.length > 0 && 
                    group.members.every(member => selectedDevices.includes(member));
                  return (
                    <Card 
                      key={group.name} 
                      onClick={() => selectGroup(group)}
                      className={`
                        p-4 cursor-pointer transition
                        ${isSelected
                          ? "ring-2 ring-primary/50 bg-primary/5 text-primary/75"
                          : "hover:bg-slate-50 text-foreground/75"}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center">
                          <UsersIcon className="h-5 w-5 text-background/100" />
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold text-md">
                            {group.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {group.members.length} member{pluralize(group.members.length)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 md:gap-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                Online Devices
              </span>
              <Badge
                variant="secondary"
                className="bg-foreground/10 text-primary/100 border-0 text-[10px] px-2 py-0.5"
              >
                {AllDevices.length} FOUND
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="gap-2 text-slate-500 hover:text-slate-700"
                onClick={openSaveGroupDialog}
              >
                <UserPlusIcon className="h-4 w-4" />
                Save as Group
              </Button>
              <Button className="gap-2 shadow-sm"
                onClick={() => { startTransaction() }}
              >
                <SendIcon className="h-4 w-4" />
                Send Now
              </Button>
            </div>
          </div>

          {AllDevices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AllDevices.map((user) => {
                const selected = selectedDevices.includes(user.public_key);
                return (
                  <Card key={user.public_key} onClick={() => registerMember(user.public_key)}
                    className={`
                    p-4 cursor-pointer transition
                    ${selected
                      ? "ring-2 ring-primary/50 bg-primary/5 text-primary/75"
                      : "hover:bg-slate-50 text-foreground/75"}
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-full h-10 w-10 bg-primary/100 flex items-center justify-center">
                        <MonitorSmartphone className="h-5 w-5 text-background/100" />
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold text-md">
                          {user.username ?? "Unknown Device"}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
              <div className="relative mb-6">
                <div className="absolute rounded-full inset-0 bg-slate-200/30 animate-ping" />
                <div className="h-16 w-16 rounded-full bg-background/100 flex items-center justify-center shadow-sm relative z-10">
                  <RadioIcon className="h-8 w-8 text-slate-300" />
                </div>
              </div>
              <h3 className="font-bold text-primary/100 text-lg mb-1">
                Scanning for devices...
              </h3>
              <p className="text-slate-500 text-sm">
                Ensure other devices enabled the discover settings.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Notification */}
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
        <Card className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 shadow-lg border-0 pl-3 pr-3 animate-in slide-in-from-bottom-4 fade-in">
          <CardContent className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-primary/100 flex items-center justify-center mr-4 shrink-0">
              {decideIcon()}
            </div>

            <div className="flex-1">
              <h4 className="font-bold text-foreground/100">
                <span className="text-lg text-primary/100 mr-1">{targetFile.length}</span> File{targetFile.length !== 1 && "s"} Selected
              </h4>
            </div>

            <Button
              className="shrink-0 p-5"
              onClick={openFilePicker}
            >
              Select Files
            </Button>
          </CardContent>
        </Card>

        {/* this is for the error dialog */}
        <AlertDialog open={errorDialog} onOpenChange={setErrorDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold text-primary/100 pb-3">
                {errorType === "group" ? "Group Error" : "Failed to start transaction"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {errorMessage || (
                  <>
                    {targetFile.length <= 0 && "Please select at least one file.\n"}
                    {selectedDevices.length <= 0 && "Please select at least one device.\n"}
                    {(activeTransaction && activeTransaction.id.length > 0) && "Already in active transaction."}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogAction onClick={() => { 
                setErrorDialog(false);
                setErrorMessage("");
                setErrorType("transaction");
              }}
                className="p-5"
              >OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Save as Group Dialog */}
        <Dialog open={saveGroupDialog} onOpenChange={setSaveGroupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-bold text-primary/100">Save as Group</DialogTitle>
              <DialogDescription>
                Create a group with the selected devices ({selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && groupName.trim()) {
                      saveGroup();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSaveGroupDialog(false);
                  setGroupName("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={saveGroup}
                disabled={!groupName.trim()}
              >
                Save Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
