'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Camera, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  MapPin, 
  AlertTriangle,
  FileText,
  ShieldCheck,
  CircleArrowRight,
  Info,
  ChevronLeft,
  X,
  Target,
  Zap,
  ShieldAlert,
  History,
  Navigation
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function WorkerTicketDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchTicket() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('*, reports ( image_url, ai_notes, severity_score )')
        .eq('id', params.id)
        .eq('assigned_to', user.id)
        .single();

      if (error || !data) {
        toast.error('ERROR: ACCESS DENIED - TARGET NOT FOUND');
        router.push('/worker/dashboard');
        return;
      }

      setTicket(data);
      setLoading(false);
    }

    fetchTicket();
  }, [params.id, router, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('ACTION REQUIRED: VERIFICATION PHOTO MISSING');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(20);
    
    const formData = new FormData();
    formData.append('action', 'resolve');
    formData.append('resolution_image', file);
    if (notes) formData.append('resolution_notes', notes);

    try {
      setUploadProgress(40);
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: formData,
      });

      setUploadProgress(80);
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'UPLINK FAILURE');
      }

      setUploadProgress(100);
      toast.success('MISSION LOGGED: AI VERIFICATION INITIATED');
      setTimeout(() => router.push('/worker/dashboard'), 1500);
    } catch (err: any) {
      toast.error(err.message || 'COMMUNICATION ERROR');
      setUploadProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl border-2 border-primary border-t-transparent animate-spin ring-1 ring-primary/20 shadow-2xl shadow-primary/10" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Synchronizing Mission Data...</p>
      </div>
    );
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const isCritical = ticket.priority === 'critical' || ticket.priority === 'high';

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground pb-24">
      <div className="container max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 animate-in fade-in duration-700">
        
        {/* Navigation Bar */}
        <nav className="mb-10 flex items-center justify-between bg-card/30 backdrop-blur-xl p-2 pr-6 rounded-2xl ring-1 ring-white/5 shadow-2xl">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="group text-[10px] font-black uppercase tracking-widest hover:bg-white/5 hover:text-primary transition-all px-4 h-11 rounded-xl"
          >
            <Link href="/worker/dashboard">
              <ChevronLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
              Return to Command
            </Link>
          </Button>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50">MISSION ID</span>
                <span className="text-[11px] font-black font-mono text-primary tracking-tighter">#{ticket.ticket_number}</span>
             </div>
             <Separator orientation="vertical" className="h-8 bg-white/10" />
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary ring-1 ring-primary/20">
                <Zap size={18} />
             </div>
          </div>
        </nav>

        <div className="grid grid-cols-1 gap-10">
          {/* Mission Objective Header */}
          <div className="space-y-8">
            <div className={cn(
              "h-2 w-full rounded-full overflow-hidden bg-white/5 ring-1 ring-white/5 shadow-inner",
              isCritical && "ring-red-500/10"
            )}>
              <div className={cn(
                "h-full transition-all duration-1000 ease-out",
                isCritical ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-primary shadow-[0_0_20px_rgba(249,115,22,0.4)]",
                "w-full"
              )} />
            </div>

            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-primary/30 text-primary text-[9px] font-black uppercase px-2 py-0.5 tracking-[0.2em] mb-2">
                    Primary Objective
                  </Badge>
                  <h1 className="text-4xl sm:text-6xl font-black tracking-tighter leading-[0.85] uppercase text-white drop-shadow-2xl">
                    {ticket.title}
                  </h1>
                </div>
                <Badge className={cn(
                  "shrink-0 h-10 px-6 text-xs font-black uppercase tracking-[0.2em] border-none shadow-2xl rounded-xl",
                  isCritical ? "bg-red-500 text-white shadow-red-500/20" : "bg-primary text-primary-foreground shadow-primary/20"
                )}>
                  {ticket.priority.toUpperCase()} PRIORITY
                </Badge>
              </div>
              
              <div className="flex items-center gap-3 text-muted-foreground bg-white/5 w-fit px-4 py-2 rounded-xl ring-1 ring-white/5">
                 <MapPin size={16} className="text-primary" />
                 <span className="text-xs font-bold uppercase tracking-widest truncate">
                    {ticket.address || `${ticket.latitude.toFixed(6)}, ${ticket.longitude.toFixed(6)}`}
                 </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Intelligence Matrix */}
            <Card className="border-none bg-card/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[40px] overflow-hidden shadow-2xl h-full">
              <CardHeader className="px-8 pt-10 pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldAlert size={18} />
                  </div>
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Field Intelligence</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-10 space-y-10">
                {ticket.description && (
                   <div className="relative p-7 rounded-[32px] bg-background/50 border border-white/5 overflow-hidden group shadow-inner">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/40" />
                      <p className="text-sm leading-relaxed text-foreground/80 font-medium italic">
                         "{ticket.description}"
                      </p>
                   </div>
                )}

                {ticket.reports?.ai_notes && (
                  <div className="p-7 rounded-[32px] bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center sm:items-start gap-5 ring-1 ring-primary/10">
                    <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-xl shadow-primary/20">
                       <ShieldCheck size={24} />
                    </div>
                    <div className="space-y-1.5 text-center sm:text-left">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">AI DIAGNOSTIC LOG</span>
                       <p className="text-xs text-foreground font-bold leading-relaxed">{ticket.reports.ai_notes}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                   <div className="flex items-center justify-between px-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Visual Proof (Initial)</Label>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5 border-white/10 text-muted-foreground tracking-widest">EVIDENCE_A</Badge>
                   </div>
                   {ticket.reports?.image_url ? (
                     <div className="relative group h-80 rounded-[40px] overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl">
                        <img 
                         src={ticket.reports.image_url} 
                         className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" 
                         alt="Initial damage" 
                       />
                       <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/40 to-transparent flex items-end p-8">
                         <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                            <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase opacity-70">Detection Vector 01-A // SCANNED</span>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="h-64 rounded-[40px] bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center opacity-30 gap-6">
                        <Target size={48} strokeWidth={1} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Digital Payload Missing</span>
                     </div>
                   )}
                </div>
              </CardContent>
            </Card>

            {/* Resolution Loop */}
            <Card className={cn(
              "border-none ring-1 rounded-[40px] transition-all duration-700 overflow-hidden h-full",
              isResolved ? "bg-emerald-500/[0.03] ring-emerald-500/20 shadow-2xl shadow-emerald-500/5" : "bg-card/60 backdrop-blur-2xl ring-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
            )}>
              <CardHeader className="p-10 pb-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl ring-4",
                        isResolved ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/5 shadow-emerald-500/10" : "bg-primary/10 text-primary ring-primary/5 shadow-primary/10"
                      )}>
                        <CircleArrowRight size={32} />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Resolution</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-mono">Status::[ {ticket.status.toUpperCase()} ]</CardDescription>
                      </div>
                    </div>
                    {isResolved && (
                      <Badge className="bg-emerald-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-xl border-none shadow-xl shadow-emerald-500/20">
                        VERIFIED
                      </Badge>
                    )}
                 </div>
              </CardHeader>

              <CardContent className="p-10 pt-4">
                {isResolved ? (
                  <div className="space-y-12 py-10">
                    <div className="text-center space-y-8">
                      <div className="relative inline-block">
                         <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse" />
                         <div className="relative w-32 h-32 rounded-[40px] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                           <CheckCircle2 size={64} className="text-emerald-400" />
                         </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Objective Secured</h3>
                        <p className="text-[11px] text-emerald-500/70 font-black uppercase tracking-[0.3em]">Resolution verified by AI Core-01</p>
                      </div>
                    </div>
                    {ticket.resolution_image_url && (
                      <div className="relative group h-96 rounded-[48px] overflow-hidden border-2 border-emerald-500/20 shadow-2xl">
                        <img src={ticket.resolution_image_url} className="w-full h-full object-cover" alt="Resolution" />
                        <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
                        <div className="absolute top-8 left-8">
                           <Badge className="bg-emerald-500 text-white text-[9px] font-black uppercase px-3 py-1.5 border-none shadow-lg">FINAL_CAPTURE_02</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleResolve} className="space-y-10 py-4">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 font-bold">Verification Payload</Label>
                         <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Mandatory Upload</span>
                      </div>
                      
                      {!previewUrl ? (
                        <label className="relative flex flex-col items-center justify-center w-full h-80 bg-background/50 border-2 border-dashed border-white/10 rounded-[48px] hover:bg-white/[0.03] hover:border-primary/50 transition-all cursor-pointer group shadow-inner ring-1 ring-white/5">
                          <div className="flex flex-col items-center justify-center text-center space-y-7">
                            <div className="w-24 h-24 rounded-[32px] bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-700 shadow-2xl ring-8 ring-primary/5">
                              <Camera className="w-10 h-10 text-primary group-hover:text-white transition-colors" />
                            </div>
                            <div className="space-y-1.5 px-10">
                              <p className="text-lg font-black uppercase tracking-tighter text-white">Capture Resolution</p>
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50 leading-relaxed">High-fidelity evidence required for autonomous audit</p>
                            </div>
                          </div>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                        </label>
                      ) : (
                        <div className="relative w-full h-80 rounded-[48px] overflow-hidden border-2 border-primary/40 shadow-2xl animate-in zoom-in-95 duration-500 group">
                          <img src={previewUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Repair preview" />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all" />
                          <button
                            type="button"
                            onClick={() => { setFile(null); setPreviewUrl(null); }}
                            className="absolute top-8 right-8 w-14 h-14 bg-black/80 backdrop-blur-xl rounded-2xl text-white hover:bg-red-500 transition-all shadow-2xl hover:scale-110 flex items-center justify-center border border-white/10"
                          >
                            <X size={24} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6">
                       <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 px-2 font-bold">Field Observations</Label>
                       <Textarea
                         id="notes"
                         value={notes}
                         onChange={(e) => setNotes(e.target.value)}
                         placeholder="INPUT MISSION LOGS, MATERIALS, AND SECTOR NOTES..."
                         className="bg-background/50 border-white/10 rounded-[32px] text-xs font-bold tracking-widest uppercase focus:ring-4 focus:ring-primary/20 h-40 resize-none transition-all placeholder:text-muted-foreground/10 p-7 ring-1 ring-white/5 shadow-inner leading-relaxed"
                       />
                    </div>

                    <div className="space-y-8">
                       {isSubmitting && (
                        <div className="space-y-4 px-4 animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                              <span>Broadcasting Uplink</span>
                              <span className="font-mono">{uploadProgress}%</span>
                           </div>
                           <Progress value={uploadProgress} className="h-2 bg-white/5 rounded-full" />
                        </div>
                       )}
                       
                       <Button
                          type="submit"
                          disabled={isSubmitting || !file}
                          className={cn(
                            "w-full h-24 rounded-[32px] text-2xl font-black uppercase tracking-tighter transition-all shadow-2xl",
                            isSubmitting ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-primary/90 shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] ring-4 ring-primary/10"
                          )}
                       >
                          {isSubmitting ? (
                           <div className="flex items-center gap-5">
                              <Loader2 className="animate-spin" size={32} />
                              <span className="tracking-[0.1em]">TRANSMITTING...</span>
                           </div>
                          ) : (
                           <div className="flex items-center gap-5">
                              <ShieldCheck size={36} strokeWidth={2.5} />
                              <span className="tracking-[0.05em]">SECURE OBJECTIVE</span>
                           </div>
                          )}
                       </Button>
                    </div>
                  </form>
                )}
              </CardContent>
              <CardFooter className="bg-white/5 p-10 flex flex-col items-center gap-4 border-t border-white/5">
                 <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-40">
                   <Signal size={14} strokeWidth={3} className="text-primary animate-pulse" />
                   Encrypted Uplink Active
                 </div>
                 <p className="text-[8px] text-muted-foreground/30 font-bold uppercase tracking-widest">Autonomous verification in progress post-transmission</p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
