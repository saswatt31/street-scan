'use client';

import { useEffect, useState } from 'react';
import { supabase, type Report } from '@/lib/supabase';
import { severityColor, damageLabel, sourceIcon, formatRelative } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { 
  X, 
  Filter, 
  Layers, 
  AlertTriangle, 
  Maximize2, 
  Target, 
  Zap,
  Map as MapIcon,
  ShieldAlert,
  Search,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false, loading: () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm gap-4">
    <div className="w-12 h-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Atlas...</span>
  </div>
)});

export default function MapPage() {
  const [reports, setReports]       = useState<Report[]>([]);
  const [workers, setWorkers]       = useState<{ id: string, email: string }[]>([]);
  const [selected, setSelected]     = useState<Report | null>(null);
  const [filter, setFilter]         = useState<string>('all');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: rData }, { data: wData }] = await Promise.all([
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('id, email').eq('role', 'repair_team')
      ]);
      setReports(rData || []);
      setWorkers(wData || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all' ? reports : reports.filter(r =>
    filter === 'critical' ? r.severity === 'critical' || r.severity === 'high' :
    filter === 'recurring' ? r.recurrence_count >= 3 :
    r.source === filter
  );

  async function assignWorker(reportId: string, ticketId: string | null, workerId: string, workerEmail: string) {
    if (!ticketId) {
      toast.error('ERROR: DATA LOSS - REPORT NOT LINKED TO TICKET');
      return;
    }
    await supabase.from('tickets').update({ assigned_to: workerId, status: 'assigned' }).eq('id', ticketId);
    await supabase.from('reports').update({ status: 'assigned' }).eq('id', reportId);
    toast.success(`LOG: UNIT DEPLOYED -> ${workerEmail.split('@')[0].toUpperCase()}`);
    setReports(rs => rs.map(r => r.id === reportId ? { ...r, status: 'assigned' } : r));
    if (selected?.id === reportId) setSelected(s => s ? { ...s, status: 'assigned' } : null);
  }

  const FILTERS = [
    { key: 'all',      label: 'ALL SECTORS' },
    { key: 'critical', label: 'THREAT LVL: HIGH' },
    { key: 'recurring',label: 'RECURRING' },
    { key: 'iot',      label: 'IOT NODES' },
    { key: 'citizen',  label: 'CITIZEN INTEL' },
    { key: 'camera',   label: 'VISUAL FEEDS' },
  ];

  return (
    <div className="relative h-full flex flex-col bg-background overflow-hidden animate-in fade-in duration-700">
      {/* Floating Filter Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[90%] lg:w-auto">
        <Card className="bg-card/40 backdrop-blur-2xl border-border/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
          <CardContent className="p-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <div className="px-4 py-2 border-r border-border/50 flex items-center gap-2 shrink-0">
               <Target size={14} className="text-primary animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">Active Scan</span>
            </div>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filter === f.key 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "hover:bg-white/5 text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
            <Separator orientation="vertical" className="h-6 mx-2 hidden lg:block opacity-30" />
            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0 hidden lg:block">
               {filtered.length} NODES IDENTIFIED
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative">
        {!loading && (
          <MapView
            reports={filtered}
            selected={selected}
            onSelect={setSelected}
          />
        )}
        {loading && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm gap-4">
             <div className="w-12 h-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">Initializing Map Engine...</span>
          </div>
        )}

        {/* Intelligence Detail Panel (Sliding) */}
        <div className={cn(
          "absolute top-6 bottom-6 right-6 w-96 z-30 transition-all duration-500 transform",
          selected ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
        )}>
          {selected && (
            <Card className="h-full bg-card/60 backdrop-blur-3xl border-border/50 shadow-2xl flex flex-col rounded-3xl ring-1 ring-white/10">
              <div className="px-6 py-6 border-b border-border/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                      <ShieldAlert size={16} className="text-primary" />
                   </div>
                   <div>
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Intelligence Detail</span>
                     <h3 className="text-sm font-black uppercase tracking-tighter">Report ID: {selected.id.slice(0, 8)}</h3>
                   </div>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="rounded-xl hover:bg-white/5">
                   <X size={18} />
                 </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10">
                {/* Visual Evidence */}
                {selected.image_url && (
                  <div className="group relative aspect-square rounded-[32px] overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl">
                    <img 
                      src={selected.image_url} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      alt="Intelligence Capture" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                       <Badge className={cn("text-[9px] font-black uppercase px-2 mb-2 border-none", severityColor(selected.severity))}>
                         {selected.severity} INTENSITY
                       </Badge>
                       <h4 className="text-xl font-black tracking-tighter uppercase text-white leading-tight">
                         {damageLabel(selected.damage_type)}
                       </h4>
                    </div>
                  </div>
                )}

                {/* Technical Coordinates */}
                <div className="space-y-4">
                   <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 opacity-60">
                     <Target size={12} className="text-primary" /> Geospatial Coordinates
                   </Label>
                   <Card className="bg-background/40 border-none ring-1 ring-white/5 p-4 rounded-2xl">
                      <p className="text-[11px] font-mono font-bold tracking-widest uppercase">
                        {selected.address ?? `${selected.latitude?.toFixed(6)}° N, ${selected.longitude?.toFixed(6)}° E`}
                      </p>
                   </Card>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Source Origin', value: selected.source, icon: MapIcon },
                    { label: 'Current State', value: selected.status.replace('_', ' '), icon: Zap },
                    { label: 'Detection Age', value: formatRelative(selected.created_at), icon: Layers },
                    { label: 'Recurrence Count', value: `${selected.recurrence_count}x`, icon: AlertTriangle },
                  ].map(({ label, value, icon: Icon }) => (
                    <Card key={label} className="bg-card/30 border-none ring-1 ring-white/5 p-3.5 rounded-2xl shadow-sm">
                       <div className="flex items-center gap-2 mb-1.5 opacity-50">
                          <Icon size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-tighter truncate">{value}</p>
                    </Card>
                  ))}
                </div>

                {/* AI Confidence Index */}
                {selected.ai_validated && (
                  <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10">
                    <div className="flex justify-between items-center mb-3">
                       <span className="text-[10px] font-black uppercase tracking-widest">AI Audit Confidence</span>
                       <span className="text-xs font-black font-mono text-primary">{Math.round(selected.ai_confidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-primary rounded-full transition-all duration-1000" 
                         style={{ width: `${selected.ai_confidence * 100}%` }} 
                       />
                    </div>
                  </div>
                )}

                {/* Assignment Vector */}
                {selected.ticket_id && (selected.status === 'open' || selected.status === 'reported') && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-widest">Field Deployment</Label>
                       <Select
                         onValueChange={(val) => {
                           const worker = workers.find(w => w.id === val);
                           if (worker) assignWorker(selected.id, selected.ticket_id, worker.id, worker.email);
                         }}
                       >
                         <SelectTrigger className="bg-background/50 border-none ring-1 ring-white/10 h-12 rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-xl">
                            <SelectValue placeholder="SELECT RESPONSE UNIT..." />
                         </SelectTrigger>
                         <SelectContent className="bg-card border-border">
                            {workers.map(w => (
                              <SelectItem key={w.id} value={w.id} className="text-[10px] font-black uppercase tracking-widest">
                                {w.email.split('@')[0]} [FIELD UNIT]
                              </SelectItem>
                            ))}
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
