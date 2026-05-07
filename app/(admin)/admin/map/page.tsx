'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  MapPin, 
  ShieldAlert, 
  Clock, 
  TrendingUp, 
  Search, 
  Filter,
  Activity,
  Layers,
  ChevronRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
  HardHat
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import toast from 'react-hot-toast';
import type { Report } from '@/lib/types';

interface Worker {
  full_name: string;
}

const MapView = dynamic(() => import('@/components/map/MapView'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[#0c0d10]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/50">Loading Cartography</span>
      </div>
    </div>
  )
});

export default function MapPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [search, setSearch]     = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function fetchData() {
    const [reportsRes, workersRes] = await Promise.all([
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, email, full_name').eq('role', 'repair_team')
    ]);

    if (reportsRes.data) setReports(reportsRes.data as Report[]);
    if (workersRes.data) setWorkers(workersRes.data as Worker[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function assignWorker(reportId: string, ticketId: string | null, workerId: string, workerEmail: string) {
    if (!ticketId) {
      toast.error("NO_TICKET_ID");
      return;
    }

    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: workerId, status: 'in_progress' })
      .eq('id', ticketId);

    if (error) {
      toast.error("DEPLOYMENT_FAILURE");
      return;
    }

    toast.success(`Unit ${workerEmail.split('@')[0]} Dispatched`);
    fetchData(); // Refresh to update status
  }

  const filtered = reports.filter(r => 
    r.damage_type.toLowerCase().includes(search.toLowerCase()) || 
    (r.nearest_landmark ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 bg-background">
        <div className="relative">
           <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
           <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Initializing Geo-Core</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background selection:bg-primary/30">
      {/* Visual Header */}
      <div className="px-8 py-8 border-b border-white/[0.05] bg-card/20 backdrop-blur-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
           <div>
             <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                   <Layers size={20} className="text-primary" />
                </div>
                <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Live Situation Map</h1>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground pl-11">Geospatial Anomaly Nexus v4.0</p>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="FILTER BY LOCATION..."
                  className="w-64 pl-10 h-11 bg-black/40 border-white/10 text-[10px] font-black tracking-widest uppercase focus-visible:ring-primary/40 rounded-xl"
                />
              </div>
              <Button variant="ghost" size="icon" className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 text-muted-foreground hover:text-primary">
                 <Filter size={16} />
              </Button>
           </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* The Map Interface */}
        <div className="flex-1 bg-[#0c0d10] relative overflow-hidden">
           <MapView 
             reports={filtered} 
             selected={selected} 
             onSelect={setSelected} 
           />
        </div>

        {/* Intelligence Side-Terminal */}
        {selected ? (
          <div className="w-[440px] flex flex-col border-l border-white/[0.05] bg-card/40 backdrop-blur-3xl animate-in slide-in-from-right duration-500 overflow-hidden">
            <div className="p-8 border-b border-white/[0.05] bg-black/20 relative shrink-0">
               <Button 
                 variant="ghost" 
                 size="icon" 
                 onClick={() => setSelected(null)}
                 className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/5"
               >
                 <ChevronRight size={16} />
               </Button>
               <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Anomaly Selected</span>
               </div>
               <h2 className="text-3xl font-black uppercase tracking-tighter mb-1 leading-none">{selected.damage_type}</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{selected.nearest_landmark}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin scrollbar-thumb-white/5">
                {/* Visual Intel */}
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visual Evidence</Label>
                  <div className="aspect-video rounded-[32px] overflow-hidden bg-black/40 ring-1 ring-white/5 relative group shadow-2xl">
                    <img 
                      src={selected.image_url} 
                      alt="Damage" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                    <Badge className={cn(
                      "absolute top-4 right-4 text-[10px] font-black border-none px-3 py-1",
                      selected.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-primary'
                    )}>
                      {selected.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Telemetry Matrix */}
                <div className="grid grid-cols-2 gap-4">
                   <Card className="bg-black/40 border-none ring-1 ring-white/10 p-5 rounded-[24px]">
                      <div className="flex items-center gap-2 mb-3">
                         <Zap size={12} className="text-primary" />
                         <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">AI Confidence</span>
                      </div>
                      <div className="text-2xl font-black font-mono tracking-tighter">{(selected.ai_confidence * 100).toFixed(1)}%</div>
                      <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${selected.ai_confidence * 100}%` }} 
                        />
                      </div>
                   </Card>

                   <Card className="bg-black/40 border-none ring-1 ring-white/10 p-5 rounded-[24px]">
                      <div className="flex items-center gap-2 mb-3">
                         <TrendingUp size={12} className="text-orange-400" />
                         <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Recurrence</span>
                      </div>
                      <div className="text-2xl font-black font-mono tracking-tighter">{selected.recurrence_count ?? 0}X</div>
                      <p className="text-[8px] font-bold text-muted-foreground mt-1 uppercase">Regional Cluster</p>
                   </Card>
                </div>

                {/* Assignment Vector */}
                {selected.ticket_id && (selected.status === 'pending' || selected.status === 'reported') && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-widest">Field Deployment</Label>
                       <Select
                         onValueChange={(val) => {
                           const worker = workers.find(w => w.id === val);
                           if (worker) assignWorker(selected.id, selected.ticket_id || null, worker.id, worker.email);
                         }}
                       >
                         <SelectTrigger className="bg-background/50 border-none ring-1 ring-white/10 h-12 rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-xl">
                            <SelectValue placeholder="SELECT RESPONSE UNIT..." />
                         </SelectTrigger>
                         <SelectContent className="bg-card border-border">
                            {workers.map(w => (
                               <SelectItem key={w.id} value={w.id} className="text-[10px] font-bold uppercase tracking-widest py-3">
                                  {w.email}
                               </SelectItem>
                            ))}
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                )}

                {/* Data Metadata */}
                <div className="space-y-4 bg-black/20 p-6 rounded-[24px] border border-white/5">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 text-primary bg-primary/5">{selected.status}</Badge>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coordinates</span>
                      <span className="text-[10px] font-mono font-bold text-white/70">{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</span>
                   </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="w-[440px] flex flex-col items-center justify-center p-12 text-center opacity-20 border-l border-white/[0.05] shrink-0">
             <Activity size={60} className="mb-6" />
             <h3 className="text-xl font-black uppercase tracking-widest">Awaiting Input</h3>
             <p className="text-[10px] font-bold mt-4 uppercase tracking-widest leading-relaxed">Select a geolocated anomaly on the map to access tactical intelligence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
