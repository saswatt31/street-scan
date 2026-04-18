'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  MapPin, 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  X, 
  ChevronRight, 
  Info,
  Map as MapIcon,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Target,
  FileText,
  BadgeCheck,
  RefreshCcw,
  Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type Step = 'form' | 'submitting' | 'done';

export default function ReportPage() {
  const [step, setStep]             = useState<Step>('form');
  const [image, setImage]           = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [gps, setGps]               = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [aiResult, setAiResult]     = useState<{ verified: boolean; explanation: string; ticket_id?: string } | null>(null);
  const [form, setForm]             = useState({
    damage_type: 'pothole',
    description: '',
    severity: 'medium',
    reporter_name: '',
    nearest_landmark: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'submitting') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => (prev >= 100 ? 100 : prev + 1.2));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step]);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
    toast.success('Evidence captured');
  }

  async function getGps() {
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true })
      );
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success('GPS Lock Acquired');
    } catch {
      toast.error('Signal Error: Enable high-accuracy GPS');
    } finally {
      setGpsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!gps) { toast.error('Location lock required for verification.'); return; }
    if (!form.nearest_landmark.trim()) { toast.error('Nearest landmark required.'); return; }
    if (!image) { toast.error('Visual evidence required.'); return; }
    
    setStep('submitting');
    setLoadingProgress(0);

    try {
      const formData = new FormData();
      if (image) formData.append('image', image);
      formData.append('latitude',    gps.lat.toString());
      formData.append('longitude',   gps.lng.toString());
      formData.append('damage_type', form.damage_type);
      formData.append('description', form.description);
      formData.append('severity',    form.severity);
      formData.append('nearest_landmark', form.nearest_landmark);
      if (form.reporter_name.trim()) formData.append('reporter_name', form.reporter_name);

      const res = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Validation failed');

      const payload = json.data || json;

      setAiResult({
        verified:    payload.verified,
        explanation: payload.explanation || payload.message,
        ticket_id:   payload.ticket_id,
      });
      
      setTimeout(() => setStep('done'), 1500); // Small buffer for visual progress
    } catch (e) {
      console.error(e);
      toast.error('Submission Interrupted');
      setStep('form');
    }
  }

  if (step === 'submitting') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0c10] noise-bg text-white overflow-hidden relative">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="relative z-10 w-full max-w-md space-y-12 text-center">
        {/* Scanner Visual */}
        <div className="relative mx-auto w-40 h-40">
           <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-pulse" />
           <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin" />
           <div className="absolute inset-4 rounded-full border border-emerald-500/10 animate-pulse-slow" />
           <div className="absolute inset-0 flex items-center justify-center">
             <Target className="w-12 h-12 text-blue-500" />
           </div>
           {/* Scanning line effect */}
           <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-400 shadow-[0_0_15px_#60a5fa] animate-scan" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black tracking-widest text-blue-400">
            <Zap size={12} />
            AI ORCHESTRATOR ACTIVE
          </div>
          <h2 className="text-3xl font-black tracking-tighter">ANALYZING SIGNAL</h2>
          <div className="space-y-2">
            <Progress value={loadingProgress} className="h-1.5 bg-white/5" indicatorClassName="bg-gradient-to-r from-blue-600 to-emerald-400" />
            <div className="flex justify-between text-[10px] font-mono text-gray-500 tracking-tighter">
              <span>IMG_PROC: {Math.round(loadingProgress)}%</span>
              <span>YOLO_V8: READY</span>
            </div>
          </div>
        </div>

        <div className="font-mono text-[10px] text-gray-500 space-y-1 h-12 overflow-hidden italic">
           {loadingProgress > 10 && <p className="animate-in fade-in">INITIALIZING TENSOR CORE...</p>}
           {loadingProgress > 40 && <p className="animate-in fade-in">EXTRACTING PIXEL AREA MAP...</p>}
           {loadingProgress > 70 && <p className="animate-in fade-in">VALIDATING GPS ANOMALIES...</p>}
        </div>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0c10] noise-bg text-white relative">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <Card className={cn(
        "max-w-md w-full border-none shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-slate-950/40 backdrop-blur-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-700",
        aiResult?.verified ? "ring-1 ring-emerald-500/30" : "ring-1 ring-red-500/30"
      )}>
        <CardHeader className="text-center pt-10 pb-4">
          <div className={cn(
            "w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3 transition-transform hover:rotate-0",
            aiResult?.verified ? "bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "bg-red-500/10 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
          )}>
            {aiResult?.verified ? <BadgeCheck size={48} /> : <AlertTriangle size={48} />}
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter uppercase italic">
            {aiResult?.verified ? 'Verification Confirmed' : 'Signal Rejected'}
          </CardTitle>
          <CardDescription className="text-gray-400 font-medium px-4 mt-2">
            "{aiResult?.explanation}"
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-8 py-6">
          {aiResult?.verified ? (
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Activity className="w-4 h-4 text-emerald-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Registry Entry</span>
                 </div>
                 <Badge className="bg-emerald-600 font-mono text-[10px]">TKT-{aiResult.ticket_id?.slice(0, 6)}</Badge>
              </div>
              <Separator className="bg-emerald-500/10" />
              <div className="space-y-3">
                {[
                  'Live tracking enabled',
                  'Dispatch unit: M-ZONE-A',
                  'ETA: < 24 Hours'
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-bold text-gray-400">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10">
               <div className="flex items-center gap-2 mb-3">
                 <AlertCircle className="w-4 h-4 text-red-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Anomaly Detected</span>
               </div>
               <p className="text-xs font-medium text-gray-500 leading-relaxed">
                 The AI was unable to verify high-confidence damage evidence. This is often due to low lighting, motion blur, or ambiguous scene data. Manual review may still apply.
               </p>
             </div>
          )}
        </CardContent>

        <CardFooter className="p-8 pt-0 flex flex-col gap-4">
          <Button 
            onClick={() => { 
              setStep('form'); setImage(null); setPreview(null); setGps(null); setAiResult(null); 
              setForm({ damage_type: 'pothole', description: '', severity: 'medium', reporter_name: '', nearest_landmark: '' }); 
            }}
            className={cn(
              "w-full h-14 text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl",
              aiResult?.verified ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20" : "bg-red-600 hover:bg-red-500 shadow-red-500/20"
            )}
          >
            {aiResult?.verified ? 'NEW PATROL REPORT' : 'RETRY CAPTURE'}
          </Button>
          <p className="text-[10px] text-center font-bold tracking-widest text-gray-600 uppercase">
            Network Status: Secure
          </p>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080a0c] text-white overflow-x-hidden pb-20 relative">
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />

      <main className="max-w-4xl mx-auto py-12 px-6 relative z-10 space-y-12">
        <header className="space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-[10px] font-black tracking-widest text-blue-400">
            <Globe size={12} className="animate-spin-slow" />
            GLOBAL INCIDENT REGISTRY
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
            Report <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Structural Anomaly</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl font-medium">
            AI-validated infrastructure reporting. Rapid diagnosis. Instant dispatch.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phase 1: Evidence */}
          <Card className="bg-white/[0.03] border-white/5 backdrop-blur-xl group hover:ring-1 hover:ring-blue-500/30 transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Camera size={14} className="text-blue-500" />
                  Primary Evidence
                </CardTitle>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-[4/3] shadow-2xl">
                  <img src={preview} alt="Evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                     <Button 
                       variant="destructive" 
                       size="sm" 
                       onClick={() => { setImage(null); setPreview(null); }}
                       className="w-full font-black uppercase text-[10px]"
                     >
                       Discard Evidence
                     </Button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileRef.current?.click()}
                  className="aspect-[4/3] cursor-pointer rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/40 transition-all group/upload"
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover/upload:scale-110 group-hover/upload:rotate-3 transition-transform">
                    <Upload size={28} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold uppercase tracking-widest text-white">Capture Photo</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-1">High-res required for AI verification</p>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
            </CardContent>
          </Card>

          {/* Phase 2: Location */}
          <Card className="bg-white/[0.03] border-white/5 backdrop-blur-xl group hover:ring-1 hover:ring-emerald-500/30 transition-all h-full">
            <CardHeader>
               <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-500" />
                  Coordinate Lock
                </CardTitle>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="h-full flex flex-col justify-center">
              {gps ? (
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 shadow-lg animate-in zoom-in-95">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Target size={24} className="text-emerald-500 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">GPS Signal Verified</p>
                    <p className="text-lg font-black font-mono text-white tracking-tighter">
                      {gps.lat.toFixed(5)} / {gps.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={getGps} 
                  disabled={gpsLoading}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/40 hover:text-emerald-400 font-black uppercase tracking-widest flex flex-col gap-2 transition-all"
                >
                  {gpsLoading ? (
                    <Loader2 className="animate-spin text-emerald-500" size={28} />
                  ) : (
                    <MapIcon className="text-emerald-500" size={28} />
                  )}
                  {gpsLoading ? 'Triangulating...' : 'Lock Signal'}
                </Button>
              )}
              <div className="mt-6 flex items-start gap-4 text-[10px] text-gray-500 p-4 rounded-xl bg-black/20 font-medium">
                <Info size={14} className="shrink-0 text-blue-500" />
                <p className="leading-relaxed">Precision spatial data is mandatory for automated repair dispatch. Enable terminal location services.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Phase 3: Metadata Details */}
        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-xl">
          <CardHeader className="border-b border-white/5 pb-8">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                 <FileText size={20} />
               </div>
               <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight italic">Incident Metadata</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest text-gray-600">Contextual training data for maintenance crews</CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-10 pt-10">
            {/* Damage Type Selection */}
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Anomaly Classification</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {['pothole', 'crack', 'subsidence', 'structural', 'flooding', 'other'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setForm(f => ({ ...f, damage_type: t }))}
                    className={cn(
                      "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border outline-none",
                      form.damage_type === t 
                        ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20 scale-[1.02]" 
                        : "bg-black/20 border-white/5 hover:border-white/20 text-gray-500"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Gradient */}
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Threat Magnitude</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'low', label: 'Monitor', color: 'bg-emerald-600 border-emerald-500' },
                  { key: 'medium', label: 'Priority', color: 'bg-amber-600 border-amber-500' },
                  { key: 'high', label: 'Hazard', color: 'bg-orange-600 border-orange-500' },
                  { key: 'critical', label: 'Structural', color: 'bg-red-600 border-red-500' },
                ].map(s => (
                  <button 
                    key={s.key}
                    onClick={() => setForm(f => ({ ...f, severity: s.key }))}
                    className={cn(
                      "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border outline-none",
                      form.severity === s.key 
                        ? `${s.color} text-white shadow-xl scale-[1.02]` 
                        : "bg-black/20 border-white/5 hover:border-white/20 text-gray-500"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
              <div className="space-y-3">
                <Label htmlFor="landmark" className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nearest Landmark <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                  <Input 
                    id="landmark"
                    placeholder="e.g. Sector 4 Bridge Entrance" 
                    value={form.nearest_landmark}
                    onChange={e => setForm(f => ({ ...f, nearest_landmark: e.target.value }))}
                    className="bg-black/40 border-white/5 h-12 pl-12 rounded-xl focus:ring-blue-500/40 text-sm font-bold placeholder:text-gray-700"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="reporter" className="text-[10px] font-black uppercase tracking-widest text-gray-500">Incident Reporter</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                  <Input 
                    id="reporter"
                    placeholder="Anonymous Operative" 
                    value={form.reporter_name}
                    onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))}
                    className="bg-black/40 border-white/5 h-12 pl-12 rounded-xl focus:ring-blue-500/40 text-sm font-bold placeholder:text-gray-700"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="desc" className="text-[10px] font-black uppercase tracking-widest text-gray-500">Structural Description</Label>
              <Textarea 
                id="desc"
                placeholder="Details of damage morphology, traffic obstruction, or surface degradation..." 
                rows={4}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-black/40 border-white/5 p-4 rounded-xl focus:ring-blue-500/40 text-sm font-bold placeholder:text-gray-700 resize-none"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-black/20 p-8 flex flex-col gap-6">
            <Button 
               onClick={handleSubmit}
               className="w-full h-16 text-lg font-black uppercase tracking-[0.2em] bg-blue-600 hover:bg-blue-500 transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-2xl shadow-blue-600/30 rounded-2xl italic"
            >
              INITIALIZE UPLOAD
              <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <div className="flex items-center gap-4 justify-center grayscale opacity-50">
               <ShieldCheck size={20} />
               <BadgeCheck size={20} />
               <Target size={20} />
            </div>
          </CardFooter>
        </Card>
      </main>

      <footer className="py-20 text-center opacity-20 font-mono text-[8px] tracking-[0.4em] uppercase">
        Signal Encrypted • StreetScan Neural Vision Engine • Rel 0.4.5
      </footer>
    </div>
  );
}

function User(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

