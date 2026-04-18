'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HardHat, LogOut, ArrowRightLeft, LayoutDashboard, ClipboardList } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { label: 'Queue', icon: ClipboardList, href: '/worker/dashboard' },
    { label: 'Public', icon: ArrowRightLeft, href: '/' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      
      {/* Premium Dark Header */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          
          {/* Brand */}
          <Link href="/worker/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg shadow-primary/10">
              <HardHat size={20} strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-black tracking-tight leading-none uppercase">Field Crew</div>
              <div className="text-[10px] text-muted-foreground font-medium tracking-[0.2em] uppercase mt-0.5">StreetScan Ops</div>
            </div>
          </Link>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Sign Out</span>
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24 sm:pb-8">
        {children}
      </main>

      {/* Professional Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border sm:hidden flex justify-around items-center px-4 h-20 pb-safe shadow-[0_-8px_20px_rgba(0,0,0,0.1)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href}
              href={item.href} 
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative group",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                isActive ? "bg-primary/10" : "group-hover:bg-muted"
              )}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              {isActive && (
                <div className="absolute -top-1 w-12 h-1 bg-primary rounded-full blur-[2px]" />
              )}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
