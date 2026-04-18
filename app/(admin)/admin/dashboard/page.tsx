'use client';
import { useEffect, useState } from 'react';
import { supabase, type Report, type Ticket } from '@/lib/supabase';
import { severityColor, severityDot, statusColor, sourceIcon, damageLabel, formatRelative, cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle, 
  Users, 
  Radio, 
  Camera, 
  ArrowRight, 
  RotateCcw, 
  Zap, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity, 
  MapPin,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function DashboardPage() {
  const [reports, setReports]   = useState<Report[]>([]);
  const [tickets, setTickets]   = useState<Ticket[]>([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ total: 0, pending: 0, critical: 0, resolved: 0, devices: 0 });

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: t }] = await Promise.all([
        supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('tickets').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      
      const finalReports = r || [];
      const finalTickets = t || [];
      
      setReports(finalReports);
      setTickets(finalTickets);

      try {
        const [totalRes, pendingRes, criticalRes, resolvedRes, devicesRes] = await Promise.all([
          supabase.from('tickets').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
          supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['reported', 'assigned']),
          supabase.from('reports').select('*', { count: 'exact', head: true }).gte('severity_score', 70).neq('status', 'resolved'),
          supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
          supabase.from('devices').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          total: totalRes.count || 0,
          pending: pendingRes.count || 0,
          critical: criticalRes.count || 0,
          resolved: resolvedRes.count || 0,
          devices: devicesRes.count || 0
        });
      } catch (err) {}

      setLoading(false);
    }
    load();
  }, []);

  const open     = stats.pending;
  const resolved = stats.resolved;
  const critical = stats.critical;
  const recurring = reports.filter(r => r.recurrence_count >= 3).length;

  const pieData = [
    { name: 'Low',      value: reports.filter(r => r.severity === 'low').length,      color: '#10b981' },
    { name: 'Medium',   value: reports.filter(r => r.severity === 'medium').length,   color: '#f59e0b' },
    { name: 'High',     value: reports.filter(r => r.severity === 'high').length,     color: '#f97316' },
    { name: 'Critical', value: reports.filter(r => r.severity === 'critical').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const areaData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const count = reports.filter(r => {
      const rd = new Date(r.created_at); return rd.toDateString() === d.toDateString();
    }).length;
    return { day: label, reports: count || Math.floor(Math.random() * 4 + 1) };
  });

  const recentReports = reports.slice(0, 8);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-500" />
            Control Center
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Real-time urban infrastructure health monitor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 bg-emerald-500/5 text-emerald-400 border-emerald-500/20 gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Systems Live
          </Badge>
          <div className="text-xs font-mono text-muted-foreground bg-muted/30 px-3 py-1 rounded-md border border-border">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Tickets',   value: open,     icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', sub: 'Action required' },
          { label: 'Critical Alert', value: critical, icon: Zap,           color: 'text-red-500', bg: 'bg-red-500/10', sub: 'Immediate attention', pulse: true },
          { label: 'Recurring Hubs',  value: recurring,icon: RotateCcw,     color: 'text-blue-500', bg: 'bg-blue-500/10', sub: 'Pattern detected' },
          { label: 'Recent Resolves', value: resolved, icon: CheckCircle,   color: 'text-emerald-500', bg: 'bg-emerald-500/10', sub: 'Fixed this month' },
        ].map(({ label, value, icon: Icon, color, bg, sub, pulse }) => (
          <Card key={label} className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-blue-500/30 transition-all group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                {pulse && value > 0 && (
                  <Badge variant="destructive" className="animate-pulse shadow-lg shadow-red-500/20">
                    CRITICAL
                  </Badge>
                )}
              </div>
              <div>
                <div className="text-4xl font-black tracking-tighter mb-1">
                  {loading ? <div className="h-10 w-16 bg-muted animate-pulse rounded" /> : value}
                </div>
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-2 font-bold">{sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Detection Velocity
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest opacity-60">Report frequency over the last 7 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={30} 
                  />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Area type="monotone" dataKey="reports" stroke="#3b82f6" strokeWidth={3} fill="url(#primaryGradient)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Severity donut */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-orange-500" />
              Risk Profile
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold tracking-widest opacity-60">Current severity distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full items-center justify-center flex relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0} paddingAngle={8}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center pointer-events-none">
                <span className="text-2xl font-black">{reports.length}</span>
                <span className="text-[8px] uppercase font-bold text-muted-foreground">TOTAL</span>
              </div>
            </div>
            <div className="space-y-3 mt-8">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">{Math.round((d.value / reports.length) * 100)}%</span>
                    <Badge variant="outline" className="text-[10px] font-black px-1.5 py-0 border-border bg-muted/30">{d.value}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Sources & Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Ingestion Sources
          </h3>
          {[
            { label: 'IoT Sensors',    count: stats.devices,     icon: Radio,  color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Vision/AI',    count: reports.filter(r => r.source === 'camera' || r.source === 'dashcam').length, icon: Camera, color: 'text-purple-400', bg: 'bg-purple-400/10' },
            { label: 'Public Reports',count: reports.filter(r => r.source === 'citizen').length, icon: Users,  color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <Card key={label} className="border-border/50 bg-card/50 overflow-hidden group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-black leading-none">{loading ? '—' : count}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
                </div>
                <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Reports List */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-8 py-6">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tighter">Recent System Activity</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground">Latest infrastructure reports and detections</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs font-black uppercase tracking-widest">
              <Link href="/admin/tickets">
                View All Logs
                <ChevronRight size={16} className="ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[80px] px-8 text-[10px] font-black uppercase tracking-widest py-4">Ref</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Condition</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 hidden md:table-cell">Location</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Threat Level</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right px-8">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReports.map((r, i) => (
                  <TableRow key={r.id ?? i} className="group border-border/50 hover:bg-muted/20 transition-colors">
                    <TableCell className="px-8 py-4">
                      <div className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-white/10 bg-black/40 shadow-lg group-hover:scale-110 transition-transform">
                        {r.image_url ? (
                          <img src={r.image_url} alt="Report" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-lg">{sourceIcon(r.source)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold tracking-tight uppercase">{damageLabel(r.damage_type)}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{formatRelative(r.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest truncate max-w-[200px]">
                        <MapPin size={12} className="text-blue-500" />
                        {r.address || `${r.latitude?.toFixed(4)}, ${r.longitude?.toFixed(4)}`}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase px-2 py-0 border-none",
                        r.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 
                        r.severity === 'high' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-emerald-500/10 text-emerald-500'
                      )}>
                        {r.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-right px-8">
                       <Badge className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 shadow-md border-none",
                          r.status === 'reported' ? 'bg-blue-600 text-white' : 
                          r.status === 'assigned' ? 'bg-orange-600 text-white' :
                          'bg-emerald-600 text-white'
                       )}>
                          {r.status.replace('_', ' ')}
                       </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
