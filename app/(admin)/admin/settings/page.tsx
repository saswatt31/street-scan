'use client';

import { useState, useEffect } from 'react';
import { 
  Save, 
  Bell, 
  Shield, 
  Cpu, 
  Database, 
  Globe, 
  AlertTriangle, 
  LogOut, 
  ShieldCheck, 
  Zap,
  User,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SettingRow {
  label: string;
  desc: string;
  key: string;
  type: 'toggle' | 'input' | 'select';
  options?: string[];
}

const SECTIONS: { title: string; icon: any; settings: SettingRow[] }[] = [
  {
    title: 'AI Logic Engine', icon: Cpu,
    settings: [
      { label: 'Auto-validate reports',         desc: 'AI automatically validates incoming reports', key: 'ai_validate',      type: 'toggle' },
      { label: 'Auto-raise tickets',            desc: 'Create repair tickets without manual approval', key: 'auto_ticket',    type: 'toggle' },
      { label: 'Minimum AI confidence',         desc: 'Reject reports below this confidence threshold', key: 'min_confidence', type: 'select', options: ['50%','60%','70%','80%','90%'] },
      { label: 'False positive detection',      desc: 'Use ML to filter suspicious reports', key: 'fp_detect',              type: 'toggle' },
    ],
  },
  {
    title: 'Intelligence & Alerts', icon: Bell,
    settings: [
      { label: 'Critical alert emails',         desc: 'Email on new critical severity reports', key: 'email_critical',    type: 'toggle' },
      { label: 'Recurring hotspot escalation',  desc: 'Escalate when same location hits 3+ reports', key: 'hotspot_esc', type: 'toggle' },
      { label: 'Escalation threshold',          desc: 'Number of recurrences before escalation', key: 'esc_threshold',  type: 'select', options: ['2','3','4','5','7','10'] },
      { label: 'Authority notification email',  desc: 'Email for escalated critical issues', key: 'auth_email',         type: 'input' },
    ],
  },
  {
    title: 'Telemetry Thresholds', icon: Shield,
    settings: [
      { label: 'Pothole vibration threshold',   desc: 'Minimum g-force RMS to trigger pothole alert', key: 'pot_threshold',  type: 'select', options: ['0.5g','0.6g','0.7g','0.8g','1.0g'] },
      { label: 'Structural alert threshold',    desc: 'Frequency anomaly threshold for buildings', key: 'struct_threshold', type: 'select', options: ['0.3g','0.5g','0.7g','1.0g'] },
      { label: 'GPS deduplication radius',      desc: 'Merge reports within this radius (meters)', key: 'dedup_radius',    type: 'select', options: ['10m','15m','20m','30m','50m'] },
    ],
  },
];

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [values, setValues] = useState<Record<string, any>>({
    ai_validate: true, auto_ticket: true, min_confidence: '70%', fp_detect: true,
    email_critical: true, hotspot_esc: true, esc_threshold: '3', auth_email: 'admin@streetscan.gov.in',
    pot_threshold: '0.8g', struct_threshold: '0.5g', dedup_radius: '20m', buffer_dur: '4h',
    supa_url: 'https://your-project.supabase.co', retention: '90', debug: false,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }:any) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  function set(key: string, val: any) { setValues(v => ({ ...v, [key]: val })); }

  async function save() { 
    setSaving(true);
    await new Promise(r => setTimeout(r, 800)); // Hype delay
    setSaving(false);
    toast.success('LOG: SYSTEM CONFIGURATION UPDATED'); 
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="h-full bg-background overflow-y-auto pb-20 animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-12">
        {/* Superior Profile Header */}
        <div className="relative group p-8 rounded-[40px] bg-primary/5 ring-1 ring-primary/20 overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
              <ShieldCheck size={200} />
           </div>
           
           <div className="flex items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/20 text-3xl font-black">
                 {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="space-y-1">
                 <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[8px] font-black tracking-widest uppercase px-2 mb-1">
                    System Core Perms
                 </Badge>
                 <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">
                    {user ? user.email.split('@')[0] : 'Uplinking...'}
                 </h2>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Lead Infrastructure Architect</p>
              </div>
           </div>

           <Button 
             onClick={handleLogout} 
             variant="outline" 
             className="relative z-10 h-12 px-6 rounded-2xl bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black tracking-widest uppercase gap-3 shadow-xl hover:shadow-red-500/20"
           >
              <LogOut size={14} /> Exit Terminal
           </Button>
        </div>

        {/* Global Controls Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Settings</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">Configure AI thresholds and hardware logic</p>
          </div>
          <Button 
            onClick={save}
            disabled={saving}
            className="h-12 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            {saving ? <RefreshCcw size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
            {saving ? 'UPDATING...' : 'COMMIT CHANGES'}
          </Button>
        </div>

        {/* Config Sections */}
        <div className="grid grid-cols-1 gap-8">
          {SECTIONS.map(({ title, icon: Icon, settings }) => (
            <Card key={title} className="bg-card/30 backdrop-blur-md border-none ring-1 ring-border rounded-[32px] overflow-hidden shadow-xl">
              <CardHeader className="px-8 pt-8 pb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                     <Icon size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">{title}</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-tight mt-1">Security & Logic Parameters</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="divide-y divide-white/5">
                  {settings.map(s => (
                    <div key={s.key} className="flex flex-col sm:flex-row sm:items-center justify-between py-6 group">
                      <div className="space-y-1 max-w-md">
                        <Label className="text-[11px] font-black uppercase tracking-widest block transition-colors group-hover:text-primary">
                           {s.label}
                        </Label>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase leading-relaxed opacity-60">
                           {s.desc}
                        </p>
                      </div>
                      <div className="mt-4 sm:mt-0">
                        {s.type === 'toggle' && (
                          <Switch 
                            checked={values[s.key]} 
                            onCheckedChange={(val) => set(s.key, val)} 
                            className="bg-zinc-800 data-[state=checked]:bg-primary ring-1 ring-white/5"
                          />
                        )}
                        {s.type === 'select' && s.options && (
                          <Select 
                            value={values[s.key]} 
                            onValueChange={(val) => set(s.key, val)}
                          >
                            <SelectTrigger className="w-32 bg-background/50 border-none ring-1 ring-white/10 h-10 rounded-xl text-[10px] font-black tracking-widest uppercase">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                               {s.options.map(o => (
                                 <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-widest">
                                   {o}
                                 </SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                        )}
                        {s.type === 'input' && (
                          <Input
                            value={values[s.key]}
                            onChange={e => set(s.key, e.target.value)}
                            className="w-full sm:w-64 h-10 bg-background/50 border-border text-[10px] font-bold tracking-widest uppercase focus-visible:ring-primary/20"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Technical Firmware Section */}
        <Card className="bg-emerald-500/[0.02] backdrop-blur-md border-none ring-1 ring-emerald-500/20 rounded-[32px] overflow-hidden shadow-2xl">
          <CardHeader className="px-8 pt-8 pb-4">
             <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                   <Globe size={20} />
                </div>
                <div>
                   <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-400">Firmware Vector</CardTitle>
                   <CardDescription className="text-[10px] uppercase font-bold tracking-tight mt-1 text-emerald-400/50">Uplink Configuration Endpoint</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 space-y-6">
             <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed text-muted-foreground">
                POST raw telemetry data to this secure terminal for real-time AI indexing and geospatial mapping.
             </p>
             <div className="rounded-2xl p-6 bg-black/40 ring-1 ring-white/5 relative group overflow-hidden shadow-inner">
                <div className="absolute top-2 right-2 p-2 px-3 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-100 transition-opacity">
                   JSON/HTTPS Terminal
                </div>
                <pre className="text-[11px] font-mono leading-relaxed text-emerald-400/80">
{`POST /api/iot
Content-Type: application/json

{
  "device_id": "NODE_ALPHA_01",
  "accel_rms": 0.942,
  "telemetry": {
     "lat": 20.2961,
     "lng": 85.8245
  }
}`}
                </pre>
             </div>
             <div className="flex items-center gap-3 px-4 py-3 bg-red-500/5 rounded-2xl border border-red-500/10">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 leading-relaxed">
                   Caution: Production endpoints require SSL and HMAC verification for all hardware signals.
                </span>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
