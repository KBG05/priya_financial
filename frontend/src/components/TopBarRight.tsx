import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TopBarRight() {
    const { theme, setTheme } = useTheme();

    const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

    return (
        <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon size={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun size={14} className="mr-2" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon size={14} className="mr-2" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor size={14} className="mr-2" /> System
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar */}
            <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">PF</AvatarFallback>
            </Avatar>
        </div>
    );
}
