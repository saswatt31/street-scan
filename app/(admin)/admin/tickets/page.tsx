'use client';

import { useEffect, useState } from 'react';
import { supabase, type Ticket } from '@/lib/supabase';
import { statusColor, severityColor, formatRelative, formatDate } from '@/lib/utils';
import { 
  Ticket as TicketIcon, 
  Search, 
  Filter, 
  ChevronDown, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Calendar,
  ShieldAlert,
  HardHat,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {Layers} from "lucide-react";
import { Label } from '@/components/ui/label';
import { Zap } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const MOCK_TICKETS: Ticket[] = [
  { id:'t1', created_at: new Date(Date.now()-3600000).toISOString(), updated_at:'', ticket_number:'SS-20240416-0001', report_id:'1', title:'Repair: Pothole at Rasulgarh', description:'Large pothole detected repeatedly by IoT sensor. Road surface severely degraded. Requires immediate patching.', priority:'critical', status:'open', assigned_team:'Emergency Response Unit', assigned_to:null, resolved_at:null, resolution_image_url:null, resolution_notes:null, ai_verified_resolved:false },
  { id:'t2', created_at: new Date(Date.now()-7200000).toISOString(), updated_at:'', ticket_number:'SS-20240416-0002', report_id:'2', title:'Repair: Road Crack at Saheed Nagar', description:'Wide longitudinal cracks across carriageway reported by citizen.', priority:'high', status:'assigned', assigned_team:'Road Maintenance Team A', assigned_to:'Rajesh Kumar', resolved_at:null, resolution_image_url:null, resolution_notes:null, ai_verified_resolved:false },
  { id:'t3', created_at: new Date(Date.now()-14400000).toISOString(), updated_at:'', ticket_number:'SS-20240416-0003', report_id:'3', title:'Repair: Pothole at Patia Junction', description:'Medium pothole near major junction. Camera-detected.', priority:'medium', status:'in_progress', assigned_team:'Road Maintenance Team B', assigned_to:'Suresh Das', resolved_at:null, resolution_image_url:null, resolution_notes:null, ai_verified_resolved:false },
];

type FilterStatus = 'all' | 'reported' | 'assigned' | 'in_progress' | 'resolved';

export default function TicketsPage() {
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [workers, setWorkers]       = useState<{ id: string, email: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState<FilterStatus>('all');
  const [selected, setSelected]     = useState<Ticket | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: tData }, { data: wData }] = await Promise.all([
        supabase.from('tickets').select('*, reports (image_url)').order('created_at', { ascending: false }),
        supabase.from('users').select('id, email').eq('role', 'repair_team')
      ]);
      setTickets(tData?.length ? tData : MOCK_TICKETS);
      setWorkers(wData || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.ticket_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === (statusFilter === 'reported' ? 'reported' : statusFilter);
    return matchSearch && matchStatus;
  });

  const counts = {
    all:         tickets.length,
    reported:    tickets.filter(t => t.status === 'reported').length,
    assigned:    tickets.filter(t => t.status === 'assigned').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
  };

  async function updateStatus(id: string, status: string) {
    await supabase.from('tickets').update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) }).eq('id', id);
    setTickets(ts => ts.map(t => t.id === id ? { ...t, status: status as any } : t));
    if (selected?.id === id) setSelected(s => s ? { ...s, status: status as any } : null);
    toast.success(`LOG: Status -> ${status.toUpperCase()}`);
  }

  async function assignWorker(ticketId: string, workerId: string, workerEmail: string) {
    await supabase.from('tickets').update({ assigned_to: workerId, status: 'assigned' }).eq('id', ticketId);
    setTickets(ts => ts.map(t => t.id === ticketId ? { ...t, assigned_to: workerId, status: 'assigned' } : t));
    if (selected?.id === ticketId) setSelected(s => s ? { ...s, assigned_to: workerId, status: 'assigned' } : null);
    toast.success(`LOG: ASSIGNED TO ${workerEmail.split('@')[0].toUpperCase()}`);
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Search & Tabs Header */}
      <div className="px-8 py-6 border-b border-border bg-card/30 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">System Tickets</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">Infrastructure Repair Nexus</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH REF / TITLE..."
                className="w-full sm:w-64 pl-10 h-10 bg-background/50 border-border text-[10px] font-bold tracking-widest uppercase focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2 bg-background/50 px-3 py-1 rounded-xl border border-border">
               <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest">{filtered.length} ACTIVE</span>
            </div>
          </div>
        </div>

        <Tabs value={statusFilter} onValueChange={(val) => setStatus(val as FilterStatus)} className="w-full">
           <TabsList className="bg-background/80 p-1 rounded-xl h-11 border border-border shadow-inner">
             {[
               { id: 'all', label: 'ALL LOGS' },
               { id: 'reported', label: 'OPEN' },
               { id: 'assigned', label: 'ASSIGNED' },
               { id: 'in_progress', label: 'ACTIVE' },
               { id: 'resolved', label: 'VERIFIED' },
             ].map(tab => (
               <TabsTrigger 
                 key={tab.id} 
                 value={tab.id}
                 className="px-6 rounded-lg text-[10px] font-black tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
               >
                 {tab.label}
                 <Badge variant="outline" className="ml-2 bg-black/20 border-none px-1.5 min-w-[20px] justify-center">
                   {counts[tab.id as keyof typeof counts]}
                 </Badge>
               </TabsTrigger>
             ))}
           </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Ticket List Pane */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0 border-r border-border transition-all duration-300",
          selected ? "hidden lg:flex" : "flex"
        )}>
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
               <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
               <span className="text-[10px] font-black tracking-[0.2em] uppercase">Initializing Feed...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30">
               <ShieldAlert size={48} className="mb-4" />
               <h3 className="text-sm font-black uppercase tracking-widest">No Logs Found</h3>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
              {filtered.map(ticket => (
                <Card 
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={cn(
                    "cursor-pointer border-none ring-1 transition-all duration-200 group relative overflow-hidden",
                    selected?.id === ticket.id 
                      ? "bg-primary/5 ring-primary shadow-lg shadow-primary/5" 
                      : "bg-card ring-border hover:ring-muted-foreground/30 hover:bg-muted/10 shadow-sm"
                  )}
                >
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-105",
                      ticket.priority === 'critical' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
                    )}>
                      <TicketIcon size={18} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-sm font-black tracking-tight uppercase truncate group-hover:text-primary transition-colors">
                          {ticket.title}
                        </h4>
                        <Badge variant="outline" className={cn(
                           "text-[8px] font-black uppercase border-none px-2",
                           ticket.status === 'open' || ticket.status === 'reported' ? "bg-blue-500/10 text-blue-400" :
                           ticket.status === 'resolved' ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"
                        )}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[10px] font-black font-mono tracking-widest text-muted-foreground">
                          {ticket.ticket_number}
                        </span>
                        <Separator orientation="vertical" className="h-3 opacity-30" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Clock size={10} />
                          {formatRelative(ticket.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  {selected?.id === ticket.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Intelligence Detail Panel */}
        {selected ? (
          <div className="flex-1 lg:w-[450px] lg:flex-none flex flex-col bg-background/50 overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="px-6 py-6 border-b border-border flex items-center justify-between bg-card/50">
               <div>
                 <span className="text-[10px] font-black font-mono tracking-[0.3em] text-primary">{selected.ticket_number}</span>
                 <h2 className="text-lg font-black tracking-tighter uppercase mt-1">Intelligence Report</h2>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="rounded-xl">
                 <X size={20} />
               </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Core Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Badge className={cn("text-[9px] font-black uppercase px-2 shadow-md border-none", severityColor(selected.priority))}>
                     {selected.priority} THREAT
                   </Badge>
                   <Badge variant="outline" className="text-[9px] font-black uppercase text-muted-foreground">
                     INTERNAL ASSET
                   </Badge>
                </div>
                <h3 className="text-2xl font-black tracking-tighter uppercase leading-tight">{selected.title}</h3>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">{selected.description}</p>
              </div>

              {/* Evidence Capture */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                     <AlertCircle size={10} /> INITIAL EVIDENCE
                   </Label>
                   <div className="aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black/40 shadow-xl group cursor-zoom-in">
                     {selected.reports?.image_url ? (
                       <img src={selected.reports.image_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Evidence" />
                     ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                          <AlertCircle size={32} />
                          <span className="text-[8px] font-black mt-2">NO DATA</span>
                       </div>
                     )}
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                     <CheckCircle2 size={10} className="text-emerald-400" /> RESOLUTION
                   </Label>
                   <div className="aspect-video rounded-2xl overflow-hidden ring-1 ring-emerald-500/30 bg-black/40 shadow-xl">
                     {selected.resolution_image_url ? (
                       <img src={selected.resolution_image_url} className="w-full h-full object-cover" alt="Resolution" />
                     ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-emerald-500/20">
                          <CheckCircle2 size={32} />
                          <span className="text-[8px] font-black mt-2">AWAITING FIX</span>
                       </div>
                     )}
                   </div>
                </div>
              </div>

              {/* Technical Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                 <Card className="bg-card/30 border-none ring-1 ring-white/5 p-4 rounded-2xl shadow-sm">
                   <CardDescription className="text-[9px] font-black uppercase tracking-widest mb-1">Captured</CardDescription>
                   <p className="text-xs font-bold flex items-center gap-2"><Calendar size={12} className="text-primary" /> {formatDate(selected.created_at)}</p>
                 </Card>
                 <Card className="bg-card/30 border-none ring-1 ring-white/5 p-4 rounded-2xl shadow-sm">
                   <CardDescription className="text-[9px] font-black uppercase tracking-widest mb-1">Squad Unit</CardDescription>
                   <p className="text-xs font-bold flex items-center gap-2"><HardHat size={12} className="text-primary" /> {selected.assigned_team || 'UNASSIGNED'}</p>
                 </Card>
              </div>

              {selected.resolved_at && (
                <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                     </div>
                     <span className="text-sm font-black uppercase tracking-tighter">Verified Resolution</span>
                   </div>
                   <p className="text-xs font-medium text-muted-foreground italic mb-2">"{selected.resolution_notes}"</p>
                   {selected.ai_verified_resolved && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[8px] font-black uppercase tracking-widest">
                        ✓ AI AUDIT SECURE
                      </Badge>
                   )}
                </div>
              )}

              {/* Action Vector */}
              {selected.status !== 'resolved' && (
                <div className="space-y-6 pt-4">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Vector Assignment</Label>
                    <Select
                      onValueChange={(val) => {
                        const worker = workers.find(w => w.id === val);
                        if (worker) assignWorker(selected.id, worker.id, worker.email);
                      }}
                      value={selected.assigned_to || ""}
                    >
                      <SelectTrigger className="bg-card border-none ring-1 ring-white/10 h-12 rounded-2xl text-[10px] font-black tracking-widest uppercase">
                        <SelectValue placeholder="DEPLOY FIELD UNIT..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {workers.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-[10px] font-bold uppercase tracking-widest">
                            {w.email.split('@')[0]} [UNIT]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Override Vector</Label>
                    <div className="grid grid-cols-2 gap-3">
                       {selected.status === 'reported' && (
                         <Button variant="outline" className="h-11 rounded-2xl text-[9px] font-black tracking-widest uppercase bg-primary/5 hover:bg-primary/20 hover:text-primary transition-all" onClick={() => updateStatus(selected.id, 'assigned')}>
                           COMMIT UNIT
                         </Button>
                       )}
                       <Button variant="outline" className="h-11 rounded-2xl text-[9px] font-black tracking-widest uppercase col-span-2 bg-emerald-500/5 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all" onClick={() => updateStatus(selected.id, 'resolved')}>
                        <Zap size={14} className="mr-2" />
                        FORCE RESOLUTION
                       </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-background/20 relative overflow-hidden group">
             <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] scale-150 rotate-12 transition-transform duration-[2s] group-hover:scale-175 group-hover:rotate-0">
                <TicketIcon size={400} />
             </div>
             <Card className="max-w-xs border-none bg-card/50 backdrop-blur-xl ring-1 ring-white/5 p-8 text-center rounded-[32px] shadow-2xl relative z-10">
                <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                   <Layers size={32} className="text-primary" />
                </div>
                <h3 className="text-lg font-black tracking-tighter uppercase mb-2">No Selection</h3>
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">Select a repair vector from the active feed to analyze and manage field operations.</p>
                <div className="mt-8 flex justify-center">
                   <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-full border border-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monitoring Vector...</span>
                   </div>
                </div>
             </Card>
          </div>
        )}
      </div>
    </div>
  );
}
