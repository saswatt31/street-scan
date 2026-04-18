'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { MapPin, Image as ImageIcon, CheckCircle, AlertTriangle, Clock, Hammer, ListChecks, Zap, ArrowRight, User, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function WorkerDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Worker');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUserId(user.id);
      setUserName(user.email?.split('@')[0] || 'Worker');

      const { data: initialTickets, error } = await supabase
        .from('tickets')
        .select(`
          *,
          reports ( image_url, ai_notes, severity_score, geohash, damage_type )
        `)
        .eq('assigned_to', user.id)
        .in('status', ['assigned', 'in_progress'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && initialTickets) {
        setTickets(initialTickets);
      }
      setLoading(false);
    }

    init();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('worker-tickets-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `assigned_to=eq.${userId}`,
        },
        async (payload) => {
          const { data: freshTickets } = await supabase
            .from('tickets')
            .select(`
              *,
              reports ( image_url, ai_notes, severity_score, geohash, damage_type )
            `)
            .eq('assigned_to', userId)
            .in('status', ['assigned', 'in_progress'])
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });
            
          if (freshTickets) {
            setTickets(freshTickets);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080a0c] text-white p-6 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
        <div className="text-sm font-bold uppercase tracking-widest text-blue-400 animate-pulse">
          Syncing Queue...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0c] text-white p-4 pb-24">
      
      {/* Premium Mobile Header */}
      <header className="mb-8 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 border-2 border-blue-500/20 ring-4 ring-blue-500/5">
            <AvatarFallback className="bg-blue-600 text-white font-black uppercase">
              {userName.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-tight">Terminal {userName}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Field Operations Unit</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1.5 py-1 px-3 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-black tracking-tighter uppercase">Net Active</span>
          </Badge>
          <span className="text-[8px] font-mono text-gray-600 uppercase">Ver: 2.4.0-REL</span>
        </div>
      </header>

      {/* Overview Stats Mini */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <ListChecks size={20} />
            </div>
            <div>
              <div className="text-xl font-black">{tickets.length}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Assigned</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-xl font-black">{tickets.filter(t => t.status === 'in_progress').length}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Hammer size={12} />
          Priority Pipeline
        </h2>
        <span className="text-[10px] text-gray-600 font-mono">SORT: DESC_SEVERITY</span>
      </div>

      {/* Ticket Feed */}
      <div className="space-y-6">
        {!tickets || tickets.length === 0 ? (
          <Card className="bg-white/[0.02] border-dashed border-white/10 py-16">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-lg font-bold">Grid Clear</h3>
              <p className="text-xs text-gray-500 mt-2 max-w-[200px]">No active infrastructure threats assigned to your unit.</p>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket: any) => {
            const isCritical = ticket.priority === 'critical' || ticket.priority === 'high';
            const reportsData = Array.isArray(ticket.reports) ? ticket.reports[0] : ticket.reports;
            const imageUrl = reportsData?.image_url;
            const score = reportsData?.severity_score ?? 0;
            const type = reportsData?.damage_type || 'Unknown';

            return (
              <Card 
                key={ticket.id} 
                className={`overflow-hidden border-none bg-white/[0.04] backdrop-blur-xl ring-1 transition-all group ${
                  isCritical ? 'ring-red-500/30' : 'ring-white/5'
                }`}
              >
                {/* Image Section with Overlays */}
                <div className="relative h-48 w-full bg-black/40 overflow-hidden">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="Damage" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
                      <ImageIcon size={40} className="mb-2 opacity-50" />
                      <span className="text-[10px] font-black uppercase tracking-widest">No Visual Data</span>
                    </div>
                  )}

                  {/* Glass Top Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/20" />

                  {/* Floating Badges */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <Badge className={`${
                      isCritical ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-orange-600 text-white shadow-lg shadow-orange-900/40'
                    } border-none font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest`}>
                      {ticket.priority}
                    </Badge>
                    
                    {score > 0 && (
                      <div className="backdrop-blur-md bg-black/40 border border-white/10 rounded-full px-3 py-1 flex items-center gap-1.5">
                        <Activity size={12} className="text-blue-400" />
                        <span className="text-[10px] font-black text-white">SCORE: {score}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Type Overlay */}
                  <div className="absolute bottom-4 left-4">
                    <div className="text-white text-lg font-black tracking-tight leading-none uppercase drop-shadow-lg">
                      {type}
                    </div>
                  </div>
                </div>

                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        <MapPin size={12} className="text-blue-500" />
                        <span className="truncate">
                          {ticket.address || (ticket.latitude ? `${ticket.latitude.toFixed(4)}, ${ticket.longitude.toFixed(4)}` : 'Location Locked')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {ticket.status === 'in_progress' && (
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black bg-emerald-400/10 w-fit px-3 py-1 rounded-full border border-emerald-400/20 mb-4 animate-pulse">
                      <Clock size={12} />
                      OP_ACTIVE
                    </div>
                  )}

                  <Separator className="bg-white/5 mb-5" />

                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98]">
                    <Link href={`/worker/ticket/${ticket.id}`} className="flex items-center justify-center gap-3">
                      Initialize Resolution
                      <ArrowRight size={18} />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Integrated Navigation Mock (Optional visual) */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-[#080a0c]/80 backdrop-blur-xl z-[100] flex items-center justify-around">
        <Button variant="ghost" size="icon" className="text-blue-500">
          <Zap size={24} />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600">
          <ListChecks size={24} />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-600">
          <User size={24} />
        </Button>
      </footer>
    </div>
  );
}
