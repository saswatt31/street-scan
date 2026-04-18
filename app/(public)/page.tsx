'use client';
import Link from 'next/link';
import { Camera, MapPin, HardHat, ShieldCheck, Activity, ArrowRight, Zap, Globe, Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Separator } from '@base-ui/react';


export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-[#0a0c10] text-white flex flex-col relative noise-bg">
      {/* Background Elements */}
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between px-6 py-5 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group">
            <Globe className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight block leading-none">StreetScan</span>
            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Infrastructure Monitor</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-all hidden md:block">
            Worker Portal
          </Link>
          <Link 
            href="/report" 
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-semibold transition-all group"
          >
            Start Reporting <Zap size={14} className="group-hover:text-yellow-400 fill-current text-transparent group-hover:fill-yellow-400 transition-all" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-6 text-center">
        <div className={`transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-8 animate-pulse-slow">
            <Activity size={14} />
            LIVE AI-POWERED VALIDATION ENABLED
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9] text-balance">
            THE STREETS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-500">NEVER SLEEP.</span>
          </h1>
          
          <p className="max-w-xl mx-auto text-lg text-gray-400 mb-10 leading-relaxed">
            Instant, AI-driven infrastructure health monitoring. Report potholes, structural cracks, and damage in seconds. 
            <span className="hidden md:inline"> Validated by YOLOv8 & Gemini.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/report"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-blue-600/20 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <Camera size={22} />
              Detect Damage
            </Link>
            <Link 
              href="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-2xl text-lg font-bold transition-all"
            >
              <HardHat size={22} className="text-blue-400" />
              Field Access
            </Link>
          </div>
        </div>

        {/* Floating Features - Integrated into screen fitting */}
        <div className={`mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl transition-all duration-1000 delay-300 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {[
            { icon: Camera, label: 'Visual Capture', desc: 'Instant GPS & Image extraction', color: 'blue' },
            { icon: ShieldCheck, label: 'AI Validation', desc: 'Powered by YOLOv8 & Gemini', color: 'emerald' },
            { icon: zapIcon, label: 'Instant Dispatch', desc: 'Direct to nearest repair crew', color: 'purple' },
          ].map((f, i) => (
            <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex items-center gap-4 text-left group hover:bg-white/[0.05] transition-all">
              <div className={`w-12 h-12 rounded-xl bg-${f.color}-500/10 flex items-center justify-center text-${f.color}-400 shrink-0 group-hover:scale-110 transition-transform`}>
                <f.icon size={24} />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">{f.label}</div>
                <div className="text-xs text-gray-500">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Footer */}
      <footer className="relative z-50 flex items-center justify-between px-8 py-4 border-t border-white/5 text-[10px] text-gray-500 font-mono tracking-widest uppercase">
        <div className="flex gap-4">
          <span>LAT: 28.6139° N</span>
          <span>LNG: 77.2090° E</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEMS OPERATIONAL
        </div>
        <div className="hidden sm:block">
          © 2026 StreetScan Hack
        </div>
      </footer>
    </div>
  );
}

function zapIcon(props: any) {
  return <Zap {...props} />;
}

