import { useState } from "react";
import {
  Home,
  Users,
  Building2,
  BarChart3,
  Settings,
  Calendar,
  Mail,
  Phone,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  // { id: "contacts", label: "Contacts", icon: Users },
  // { id: "companies", label: "Companies", icon: Building2 },
  // { id: "deals", label: "Deals", icon: Target },
  // { id: "analytics", label: "Analytics", icon: BarChart3 },
  // { id: "calendar", label: "Calendar", icon: Calendar },
  // { id: "email", label: "Email", icon: Mail },
  // { id: "calls", label: "Calls", icon: Phone },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <div className="h-screen bg-crm-sidebar border-r border-border/50 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-crm-sidebar-muted/20">
        <h1 className="text-xl font-bold text-crm-sidebar-foreground">
          CRM<span className="text-crm-sidebar-accent">Pro</span>
        </h1>
        <p className="text-sm text-crm-sidebar-muted mt-1">Customer Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                isActive
                  ? "bg-crm-sidebar-accent text-white shadow-md"
                  : "text-crm-sidebar-muted hover:text-crm-sidebar-foreground hover:bg-crm-sidebar-muted/10"
              )}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-crm-sidebar-muted/20">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-crm-sidebar-muted/10">
          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
            JD
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-crm-sidebar-foreground">John Doe</p>
            <p className="text-xs text-crm-sidebar-muted">Sales Manager</p>
          </div>
          <Settings size={16} className="text-crm-sidebar-muted" />
        </div>
      </div>
    </div>
  );
}