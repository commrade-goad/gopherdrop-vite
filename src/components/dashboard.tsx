import * as React from "react";
import {
    MonitorSmartphone,
    UserPlusIcon,
    SendIcon,
    RadioIcon,
    FileIcon,
    Files,
    Smile,
    MenuIcon,
} from "lucide-react";
import { gopherSocket, WSTypes } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";
import { User, WeirdUserWrapper } from "@/lib/def";
import { Input } from "@/components/ui/input";
import { getPublicKey } from "@/lib/helper";

interface DashboardProps {
    onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [AllDevices, setAllDevices] = React.useState<User[]>([]);
    const [selectedDevices, setSelectedDevices] = React.useState<string[]>([]);
    const [targetFile, setTargetFile] = React.useState<File[]>([]);

    const startTransaction = () => {
        gopherSocket.send(WSTypes.NEW_TRANSACTION, null);
    };
    const fileInputRef = React.useRef<HTMLInputElement>(null); // i use shadcn and i have <Input> plaese use that with the file variant
    const openFilePicker = () => {
        fileInputRef.current?.click();
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setTargetFile(files);
    };

    const decideIcon = () => {
        if (targetFile.length <= 0) return <Smile className="h-6 w-6 text-white"/>;
        else if (targetFile.length == 1) return <FileIcon className="h-6 w-6 text-white"/>;
        else return <Files className="h-6 w-6 text-white"/>;
    }

    const registerMember = (public_key: string) => {
        setSelectedDevices(prev => {
            if (prev.includes(public_key)) {
                return prev.filter(k => k !== public_key);
            }
            return [...prev, public_key];
        });
    };

    React.useEffect(() => {
        let interval: number;
        const myPublicKey = getPublicKey();
        const handler = (devices: WeirdUserWrapper[]) => {
            if (devices.length <= 0) {
                setAllDevices([]);
                return;
            }
            const output: User[] = devices.map(d => d.user)
                .filter(u => u.public_key !== myPublicKey);
            setAllDevices(output);
        };

        (async () => {
            await gopherSocket.waitUntilConnected();

            gopherSocket.on(WSTypes.USER_SHARE_LIST, handler);
            gopherSocket.send(WSTypes.START_SHARING, null);
            interval = window.setInterval(() => {
                gopherSocket.send(WSTypes.START_SHARING, null);
            }, 3000);
        })();

        return () => {
            clearInterval(interval);
        };
    }, []);

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
                </header>

                {/* Content */}
                <div className="flex-1 p-4 md:p-8 bg-slate-50/50">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 md:gap-0">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                                Online Devices
                            </span>
                            <Badge
                                variant="secondary"
                                className="bg-cyan-100/50 text-cyan-600 hover:bg-cyan-100 border-0 text-[10px] px-2 py-0.5 rounded-sm"
                            >
                                {AllDevices.length} FOUND
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
                            <Button className="bg-cyan-400 hover:bg-cyan-500 text-white gap-2 shadow-sm shadow-cyan-200"
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
                                                ? "border-cyan-400 ring-2 ring-cyan-300 bg-cyan-50"
                                                : "hover:bg-slate-50"}
                                        `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center">
                                                <MonitorSmartphone className="h-5 w-5 text-cyan-600" />
                                            </div>

                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-900 text-md">
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
                                <div className="absolute inset-0 bg-slate-200/30 rounded-full animate-ping" />
                                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm relative z-10">
                                    <RadioIcon className="h-8 w-8 text-slate-300" />
                                </div>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">
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
                        <div className="h-12 w-12 rounded-full bg-cyan-400 flex items-center justify-center mr-4 shrink-0">
                        { decideIcon() }
                        </div>

                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900">
                                <span className="text-lg text-cyan-600 mr-1">{targetFile.length}</span> File{targetFile.length !== 1 && "s"} Selected
                            </h4>
                        </div>

                        <Button
                            className="bg-cyan-400 text-white hover:bg-slate-800 shrink-0"
                            onClick={openFilePicker}
                        >
                            Select Files
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
