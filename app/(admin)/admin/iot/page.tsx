'use client';

import { useState, useEffect } from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Activity, 
  MapPin, 
  Cpu, 
  Zap, 
  Battery, 
  Loader2,
  RefreshCcw,
  Signal,
  Database,
  Satellite,
  HardHat,
  Users,
  Search,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DeviceStatus = 'online' | 'offline' | 'alert';

interface Device {
  id: string;
  name: string;
  type: 'vehicle' | 'building' | 'static';
  status: DeviceStatus;
  lastSeen: string;
  lat?: number;
  lng?: number;
  address?: string;
  battery?: number;
  vibrationRms?: number;
  alertCount: number;
  totalReports: number;
  connectivity: 'wifi' | 'sim';
  owner_id?: string;
}

interface Worker {
  id: string;
  email: string;
  full_name: string;
}

function statusBadge(s: DeviceStatus) {
  if (s === 'online') return { text: 'ACTIVE', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
  if (s === 'alert')  return { text: 'ALERT',  color: 'text-red-400', bg: 'bg-red-400/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
  return { text: 'OFFLINE', color: 'text-zinc-500', bg: 'bg-white/5' };
}

function typeIcon(t: string) {
  if (t === 'vehicle')  return <Radio size={16} className="text-blue-400" />;
  if (t === 'building') return <Database size={16} className="text-purple-400" />;
  return <Cpu size={16} className="text-orange-400" />;
}

export default function IotPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Device | null>(null);
  const [liveVib, setLiveVib]   = useState<number[]>([]);
  const [search, setSearch]     = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function fetchInitialData() {
    const [devicesRes, workersRes] = await Promise.all([
      supabase.from('devices').select('*, iot_data(count)').order('last_seen_at', { ascending: false }),
      supabase.from('users').select('id, email, full_name').eq('role', 'repair_team')
    ]);

    if (workersRes.data) setWorkers(workersRes.data as Worker[]);

    if (devicesRes.data) {
      const mapped: Device[] = devicesRes.data.map(d => {
        const lastSeenDate = d.last_seen_at ? new Date(d.last_seen_at) : null;
        const isOnline = lastSeenDate && (Date.now() - lastSeenDate.getTime() < 300000); // 5 mins threshold
        
        return {
          id: d.id,
          name: d.name,
          type: d.type as any,
          status: isOnline ? 'online' : 'offline',
          lastSeen: lastSeenDate ? `${formatDistanceToNow(lastSeenDate)} ago` : 'Never',
          lat: d.latitude,
          lng: d.longitude,
          address: d.address || 'Location Unknown',
          battery: d.battery_pct ?? 0,
          vibrationRms: d.vibration_rms || 0,
          alertCount: 0,
          totalReports: d.iot_data?.[0]?.count || 0,
          connectivity: 'wifi',
          owner_id: d.owner_id
        };
      });
      setDevices(mapped);
      
      // Update the currently selected device if it exists
      if (selected) {
        const updatedSelected = mapped.find(d => d.id === selected.id);
        if (updatedSelected) setSelected(updatedSelected);
      } else if (mapped.length > 0) {
        setSelected(mapped[0]);
      }
    }
    setLoading(false);
  }

  async function assignWorker(deviceId: string, workerId: string) {
    const isClearing = workerId === "none";
    const updateData = { owner_id: isClearing ? null : workerId };
    
    const { error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('id', deviceId);

    if (error) {
      toast.error("COMM_LINK_FAILURE");
      return;
    }

    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, owner_id: isClearing ? null : workerId } : d));
    if (selected?.id === deviceId) {
      setSelected(prev => prev ? { ...prev, owner_id: isClearing ? null : workerId } : null);
    }
    toast.success(isClearing ? "Assignment Cleared" : "Unit Assigned");
  }

  useEffect(() => {
    fetchInitialData();
    const sub = supabase
      .channel('devices_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => fetchInitialData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (!selected || selected.status === 'offline') {
      setLiveVib([]);
      return;
    }
    const interval = setInterval(() => {
      const base = 0.2;
      const noise = (Math.random() - 0.5) * 0.4;
      setLiveVib(prev => [...prev.slice(-39), Math.max(0, base + noise)]);
    }, 400);
    return () => clearInterval(interval);
  }, [selected]);

  const filtered = devices.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.id.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    online:  devices.filter(d => d.status === 'online').length,
    alert:   devices.filter(d => d.status === 'alert').length,
    offline: devices.filter(d => d.status === 'offline').length,
  };

  if (loading) {
     return (
       <div className="h-full flex flex-col items-center justify-center gap-6 bg-background">
         <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
         </div>
         <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Establishing Uplink</span>
       </div>
     );
  }

  return (
    <div className="h-full flex flex-col bg-background selection:bg-primary/30">
      {/* Network Control Header */}
      <div className="px-8 py-8 border-b border-white/[0.05] bg-card/20 backdrop-blur-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
           <div>
             <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                   <Signal size={20} className="text-primary" />
                </div>
                <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">Node Network</h1>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground pl-11">Industrial IoT Telemetry Nexus</p>
           </div>

           <div className="flex flex-wrap items-center gap-6">
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="FILTER NODES..."
                  className="w-full sm:w-64 pl-10 h-11 bg-black/40 border-white/10 text-[10px] font-black tracking-widest uppercase focus-visible:ring-primary/40 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10 shadow-inner">
                <div className="flex px-5 py-2.5 gap-10 items-center">
                  {[
                    { label: 'ACTIVE',  val: stats.online,  col: 'bg-emerald-400' },
                    { label: 'ALERT',   val: stats.alert,   col: 'bg-red-500' },
                    { label: 'STATIC',  val: stats.offline, col: 'bg-zinc-600' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col items-center">
                      <span className="text-sm font-black text-white">{s.val}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                         <div className={cn("w-1.5 h-1.5 rounded-full", s.col, s.val > 0 && s.col !== 'bg-zinc-600' && "animate-pulse")} />
                         <span className="text-[8px] font-black tracking-[0.2em] text-muted-foreground">{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator orientation="vertical" className="h-10 opacity-20" />
                <Button variant="ghost" size="icon" onClick={fetchInitialData} className="w-12 h-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground">
                   <RefreshCcw size={16} />
                </Button>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Hardware Discovery Pane */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin scrollbar-thumb-white/5">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
              <Satellite size={80} className="mb-8" />
              <h3 className="text-2xl font-black uppercase tracking-[0.3em] text-white">No Signal Found</h3>
              <p className="text-xs font-bold mt-4 max-w-xs uppercase leading-relaxed tracking-widest text-muted-foreground">Scanning frequency spectrum... Connect sensor hardware to see telemetry data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
              {filtered.map(device => {
                const badge = statusBadge(device.status);
                const isSelected = selected?.id === device.id;
                const assignedWorker = workers.find(w => w.id === device.owner_id);
                
                return (
                  <Card 
                    key={device.id}
                    onClick={() => { setSelected(device); setLiveVib([]); }}
                    className={cn(
                      "group cursor-pointer border-none ring-1 transition-all duration-300 relative overflow-hidden rounded-[32px] bg-card/40 backdrop-blur-sm",
                      isSelected 
                        ? "ring-primary bg-primary/5 shadow-2xl shadow-primary/20 translate-y-[-4px]" 
                        : "ring-white/5 hover:ring-primary/40 hover:bg-card shadow-lg"
                    )}
                  >
                    <CardContent className="p-8 space-y-6">
                       <div className="flex items-start justify-between">
                         <div className="flex items-center gap-4">
                           <div className="w-14 h-14 rounded-[20px] bg-black/60 flex items-center justify-center shadow-inner ring-1 ring-white/10 group-hover:ring-primary/30 transition-all">
                              {typeIcon(device.type)}
                           </div>
                           <div className="min-w-0">
                             <h4 className="text-md font-black uppercase tracking-tighter truncate leading-none mb-1.5 group-hover:text-primary transition-colors text-white">
                               {device.name}
                             </h4>
                             <div className="flex items-center gap-2">
                                <span className={cn("w-1.5 h-1.5 rounded-full", device.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600')} />
                                <span className="text-[9px] font-mono font-bold tracking-widest text-muted-foreground opacity-50 block uppercase truncate">
                                  ID: {device.id.slice(0, 15)}...
                                </span>
                             </div>
                           </div>
                         </div>
                         <Badge variant="outline" className={cn("text-[9px] font-black px-3 py-1 border-none tracking-widest uppercase", badge.bg, badge.color)}>
                            {badge.text}
                         </Badge>
                       </div>

                       <div className="flex items-center gap-4">
                          <div className="flex-1 py-2.5 px-4 rounded-xl bg-black/40 flex items-center gap-3 ring-1 ring-white/5">
                             <MapPin size={12} className="text-primary/70" />
                             <span className="text-[10px] font-black tracking-widest text-white/80 uppercase truncate">
                               {device.address}
                             </span>
                          </div>
                       </div>
                       
                       <div className="pt-6 flex items-center justify-between border-t border-white/[0.05]">
                          <div className="flex items-center gap-5">
                             <div className="flex flex-col">
                               <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Energy</span>
                               <span className={cn("text-xs font-black font-mono", device.battery < 20 ? 'text-red-500' : 'text-white')}>
                                 {device.battery}%
                               </span>
                             </div>
                             <Separator orientation="vertical" className="h-8 opacity-10" />
                             <div className="flex flex-col">
                               <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Assigned To</span>
                               <span className="text-[10px] font-black text-white/90 uppercase tracking-tighter truncate max-w-[80px]">
                                 {assignedWorker ? assignedWorker.email.split('@')[0] : 'VACANT'}
                               </span>
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-end">
                             <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Last Seen</span>
                             <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                               {device.lastSeen.toUpperCase()}
                             </span>
                          </div>
                       </div>
                    </CardContent>
                    
                    {isSelected && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-primary shadow-[0_-4px_12px_rgba(59,130,246,0.5)]" />
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Intelligence Side-Terminal */}
        {selected ? (
          <div className="hidden lg:flex w-[480px] flex-col border-l border-white/[0.05] bg-card/30 backdrop-blur-3xl animate-in slide-in-from-right duration-500 overflow-hidden">
            <div className="p-10 border-b border-white/[0.05] bg-black/20 shrink-0">
               <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Live Data Stream</span>
               </div>
               <h2 className="text-3xl font-black uppercase tracking-tighter mb-1 text-white">{selected.name}</h2>
               <p className="text-[10px] font-mono font-bold text-muted-foreground opacity-40 uppercase tracking-[0.2em] break-all">ID::{selected.id}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-12 scrollbar-thin scrollbar-thumb-white/5">
               {/* Telemetry Stats */}
               <div className="grid grid-cols-2 gap-5">
                  {[
                    { label: 'Event Total', val: selected.totalReports, icon: Database, color: 'text-blue-400' },
                    { label: 'Alert Signals', val: selected.alertCount, icon: Zap, color: 'text-red-400' },
                  ].map(stat => (
                    <Card key={stat.label} className="bg-black/40 border-none ring-1 ring-white/10 p-6 rounded-[32px] group hover:ring-primary/30 transition-all">
                       <stat.icon size={16} className={cn("mb-4 opacity-50 group-hover:opacity-100 transition-opacity", stat.color)} />
                       <div className="text-3xl font-black font-mono tracking-tighter mb-1 text-white">{stat.val}</div>
                       <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                    </Card>
                  ))}
               </div>

               {/* Unit Deployment Assignment */}
               <div className="space-y-6">
                  <div className="flex items-center gap-2">
                     <Users size={14} className="text-primary" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tactical Unit Assignment</span>
                  </div>
                  
                  <Card className="bg-primary/5 border-none ring-1 ring-primary/20 p-8 rounded-[40px] relative overflow-hidden group shadow-2xl">
                     <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                        <Users size={80} className="text-primary" />
                     </div>
                     
                     <div className="relative z-10 space-y-6">
                        <div className="space-y-3">
                           <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Repair Team Email</label>
                           <Select 
                              onValueChange={(val) => assignWorker(selected.id, val)}
                              value={selected.owner_id || "none"}
                           >
                              <SelectTrigger className="bg-black/60 border-white/10 h-12 text-[11px] font-black tracking-widest uppercase rounded-2xl focus:ring-primary shadow-inner text-white">
                                 <SelectValue placeholder="DEPLOY FIELD UNIT..." />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-950 border-white/10 shadow-3xl">
                                 <SelectItem value="none" className="text-[10px] font-black uppercase tracking-widest opacity-50">NULL :: UNASSIGNED</SelectItem>
                                 <Separator className="my-2 opacity-5" />
                                 {workers.map(w => (
                                    <SelectItem key={w.id} value={w.id} className="text-[11px] font-black uppercase tracking-widest py-3">
                                       {w.email}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </div>

                        {selected.owner_id && (
                           <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 animate-in slide-in-from-bottom duration-500">
                              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                              <div className="flex flex-col">
                                 <span className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-400">Unit Confirmed</span>
                                 <span className="text-[10px] font-bold text-white/50 uppercase truncate max-w-[200px]">
                                    {workers.find(w => w.id === selected.owner_id)?.email}
                                 </span>
                              </div>
                           </div>
                        )}
                     </div>
                  </Card>
               </div>

               {/* Power Cell Management */}
               <div className="space-y-5 bg-black/20 p-8 rounded-[32px] ring-1 ring-white/5 relative overflow-hidden">
                  <div className="flex justify-between items-center relative z-10">
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Power Cell Life</span>
                     <Badge variant="outline" className={cn("text-[10px] font-black border-none px-0", selected.battery < 20 ? 'text-red-400' : 'text-primary')}>
                        {selected.battery}%
                     </Badge>
                  </div>
                  <Progress 
                    value={selected.battery} 
                    className="h-2 rounded-full bg-white/5 ring-1 ring-white/5" 
                  />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Est. Runtime</span>
                        <span className="text-[10px] font-bold text-white uppercase">12.4 Hours</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Cell Health</span>
                        <span className={cn("text-[10px] font-bold uppercase", selected.battery < 20 ? 'text-red-500' : 'text-emerald-400')}>
                           {selected.battery < 20 ? 'Critical' : 'Stable'}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Live Signal Processing */}
               <div className="space-y-5 pb-10">
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vibration Magnitude (RMS)</span>
                     {selected.status === 'online' && (
                       <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live Uplink</span>
                       </div>
                     )}
                  </div>
                  
                  <div className="rounded-[40px] bg-black border border-white/10 p-8 shadow-2xl relative overflow-hidden group">
                     {selected.status === 'online' ? (
                       <div className="space-y-6">
                         <div className="flex items-end gap-1.5 h-32">
                           {Array.from({ length: 40 }, (_, i) => {
                             const val = liveVib[i] ?? 0;
                             const h   = Math.max(10, Math.min(val * 150, 100)); 
                             const col = val > 1.0 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : val > 0.6 ? 'bg-orange-500' : 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]';
                             return (
                               <div 
                                 key={i} 
                                 className={cn("flex-1 rounded-full transition-all duration-300", col, i < liveVib.length ? "opacity-100" : "opacity-10")}
                                 style={{ height: `${h}%` }} 
                               />
                             );
                           })}
                         </div>
                         <div className="flex justify-between items-center bg-white/[0.03] rounded-2xl p-4 border border-white/[0.05]">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Data Point Magnitude</span>
                            <span className="text-2xl font-black font-mono tracking-tighter text-primary">
                               {liveVib.length > 0 ? liveVib[liveVib.length - 1]?.toFixed(4) : '0.0000'} <span className="text-[10px] ml-1 text-muted-foreground opacity-50 font-sans">G</span>
                            </span>
                         </div>
                       </div>
                     ) : (
                       <div className="h-44 flex flex-col items-center justify-center opacity-20 gap-4">
                          <Signal size={40} className="text-white" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Signal Terminated</span>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-black/10 relative overflow-hidden group">
             <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] scale-150 transition-all duration-[3s] group-hover:scale-125 group-hover:rotate-6 pointer-events-none text-white">
                <Satellite size={600} />
             </div>
             <Card className="max-w-md border-none bg-card/40 backdrop-blur-2xl ring-1 ring-white/10 p-12 text-center rounded-[48px] shadow-2xl relative z-10">
                <div className="w-20 h-20 rounded-[32px] bg-primary/20 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/20 ring-1 ring-primary/30">
                   <Signal size={40} className="text-primary" />
                </div>
                <h3 className="text-2xl font-black tracking-[0.1em] uppercase mb-4 text-white">Select Vector</h3>
                <p className="text-xs font-bold text-muted-foreground leading-relaxed uppercase tracking-widest opacity-60">Initialize local node inspection to access high-fidelity telemetry and operational assignment vectors.</p>
                <div className="mt-10 flex justify-center">
                   <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full border border-primary/20 shadow-lg shadow-primary/5">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Scanning Stream...</span>
                   </div>
                </div>
             </Card>
          </div>
        )}
      </div>
    </div>
  );
}
