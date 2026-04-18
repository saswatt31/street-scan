'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Map, Ticket, Radio, Settings, Zap, Bell, Menu, X, ArrowRightLeft, Shield
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: '/admin/dashboard',   label: 'Control Center', icon: LayoutDashboard },
  { href: '/admin/map',         label: 'Live Map',       icon: Map },
  { href: '/admin/tickets',     label: 'System Tickets', icon: Ticket },
  { href: '/admin/iot',         label: 'IoT Devices',    icon: Radio },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sideOpen, setSideOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground uppercase-header">
      {/* Mobile overlay */}
      {sideOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-all" onClick={() => setSideOpen(false)} />
      )}

      {/* Admin Sidebar */}
      <aside className={cn(
        'fixed lg:relative z-50 lg:z-auto flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out',
        'w-64 shrink-0',
        sideOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-border mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-black tracking-tighter uppercase leading-none">
              Control Center
            </div>
            <div className="text-[10px] text-muted-foreground font-medium tracking-[0.2em] uppercase mt-1">StreetScan AI</div>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSideOpen(false)}>
            <X size={20} />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-black px-4 mb-4 text-muted-foreground/50 uppercase tracking-[0.3em]">
            Command
          </div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 font-bold group',
                  active 
                    ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(249,115,22,0.1)]' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => setSideOpen(false)}>
                <Icon size={18} className={cn("transition-colors", active ? "text-primary" : "group-hover:text-foreground")} />
                {label}
              </Link>
            );
          })}

          <div className="text-[10px] font-black px-4 mb-4 mt-10 text-muted-foreground/50 uppercase tracking-[0.3em]">
            Configuration
          </div>
          <Link href="/admin/settings"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 font-bold group', 
              pathname.includes('/admin/settings') 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}>
            <Settings size={18} className={cn("transition-colors", pathname.includes('/admin/settings') ? "text-primary" : "group-hover:text-foreground")} />
            Settings
          </Link>
        </nav>

        {/* Logout / Switch */}
        <div className="px-5 py-6 border-t border-border mt-auto">
           <Button variant="ghost" className="w-full justify-start gap-3 h-11 px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50 font-bold rounded-xl" asChild>
             <Link href="/">
               <ArrowRightLeft size={16} />
               Public Portal
             </Link>
           </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 h-20 border-b border-border bg-background/50 backdrop-blur-xl z-40 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSideOpen(true)}>
            <Menu size={24} />
          </Button>

          <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 gap-2 px-3 py-1.5 font-bold tracking-widest text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            LIVE · OPS SECURE
          </Badge>

          <div className="ml-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative group hover:bg-primary/5">
              <Bell size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] border-2 border-background" />
            </Button>
            <Separator orientation="vertical" className="h-8 hidden sm:block opacity-50" />
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-black uppercase tracking-tighter">S. AGRAWAL</div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Prime Admin</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black bg-gradient-to-tr from-primary to-orange-400 text-primary-foreground shadow-xl shadow-primary/20 ring-1 ring-white/10 select-none">
                SA
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#09090b]">
          {children}
        </main>
      </div>
    </div>
  );
}
