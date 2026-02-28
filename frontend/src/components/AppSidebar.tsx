import {
    Sidebar, SidebarContent, SidebarHeader, SidebarMenu,
    SidebarMenuItem, SidebarMenuButton, SidebarFooter,
} from "@/components/ui/sidebar";
import {
    BarChart3, TrendingUp, Package, Target, Receipt, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "pal1" | "mty" | "consumption" | "kpis" | "direct_expenses";

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "pal1", label: "PAL-1 (P&L)", icon: BarChart3 },
    { id: "mty", label: "MTY", icon: TrendingUp },
    { id: "consumption", label: "Consumption", icon: Package },
    { id: "kpis", label: "KPI Scorecard", icon: Target },
    { id: "direct_expenses", label: "Direct Expenses", icon: Receipt },
];

interface AppSidebarProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
                        <Activity size={14} className="text-sidebar-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold leading-none text-sidebar-foreground truncate">MIS Dashboard</p>
                        <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">FY 2025–26 · PriyaFil</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="py-2 px-2">
                <SidebarMenu className="gap-0.5">
                    {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                        const isActive = activeTab === id;
                        return (
                            <SidebarMenuItem key={id}>
                                <SidebarMenuButton
                                    onClick={() => onTabChange(id)}
                                    isActive={isActive}
                                    className={cn(
                                        "group relative rounded-lg px-3 py-2 transition-all duration-150",
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                                    )}
                                >
                                    {/* Active indicator bar */}
                                    {isActive && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-sidebar-primary" />
                                    )}
                                    <Icon size={15} className="shrink-0" />
                                    <span className="text-[13px]">{label}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
                <p className="text-[10px] text-sidebar-foreground/40">v2.0</p>
            </SidebarFooter>
        </Sidebar>
    );
}
