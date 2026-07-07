"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/command-center/AnimatedBackground";
import { GlassCard } from "@/components/command-center/GlassCard";
import { Button } from "@/components/ui/button";

// Slide Data & Structure
const SLIDES = [
    { id: "hero", title: "Overview", icon: "Activity" },
    { id: "ecosystem", title: "Ecosystem", icon: "Layers" },
    { id: "treasury", title: "Treasury Flow", icon: "UserCheck" },
    { id: "payables", title: "Accounts Payable", icon: "Coins" },
    { id: "cashflow", title: "Cash Flow Forecast", icon: "TrendingUp" },
    { id: "architecture", title: "Architecture", icon: "Cpu" },
    { id: "sandbox", title: "Live Sandbox", icon: "Play" },
    { id: "conclusion", title: "Value Delivery", icon: "CheckCircle2" },
];

export default function PresentationPage() {
    const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [autoplayProgress, setAutoplayProgress] = React.useState(0);
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    // Slide navigation
    const nextSlide = React.useCallback(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % SLIDES.length);
        setAutoplayProgress(0);
    }, []);

    const prevSlide = React.useCallback(() => {
        setCurrentSlideIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
        setAutoplayProgress(0);
    }, []);

    // Autoplay Timer Effect
    React.useEffect(() => {
        if (!isPlaying) return;
        
        const duration = 12000; // 12 seconds per slide
        const intervalTime = 100;
        let elapsed = 0;

        const timer = setInterval(() => {
            elapsed += intervalTime;
            setAutoplayProgress((elapsed / duration) * 100);
            
            if (elapsed >= duration) {
                nextSlide();
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [isPlaying, nextSlide]);

    // Keyboard controls
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "Space") {
                e.preventDefault();
                nextSlide();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prevSlide();
            } else if (e.key === "Escape") {
                setIsMenuOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [nextSlide, prevSlide]);

    // Slide rendering helper
    const renderSlideContent = () => {
        const slideId = SLIDES[currentSlideIndex].id;
        switch (slideId) {
            case "hero":
                return <HeroSlide onStartPresentation={() => setCurrentSlideIndex(1)} />;
            case "ecosystem":
                return <EcosystemSlide />;
            case "treasury":
                return <TreasurySlide />;
            case "payables":
                return <PayablesSlide />;
            case "cashflow":
                return <CashFlowSlide />;
            case "architecture":
                return <ArchitectureSlide />;
            case "sandbox":
                return <SandboxSlide />;
            case "conclusion":
                return <ConclusionSlide onRestart={() => setCurrentSlideIndex(0)} />;
            default:
                return null;
        }
    };

    return (
        <div className="relative min-h-screen text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-hidden select-none">
            {/* Prismatic Animated Mesh Grid Background */}
            <AnimatedBackground />

            {/* Top Branding & Progress Line */}
            <header className="relative z-30 px-6 py-4 flex items-center justify-between border-b border-slate-900/5 dark:border-white/5 bg-white/40 dark:bg-slate-950/20 backdrop-blur-md">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="h-8 w-8 rounded-lg bg-cyan-600 dark:bg-cyan-500 flex items-center justify-center text-white font-black italic text-sm shadow-md group-hover:scale-105 transition-transform">
                        V
                    </div>
                    <span className="font-black text-xs tracking-widest uppercase dark:text-white">
                        VOS ERP <span className="text-cyan-500">FMS</span>
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <div className="text-[11px] font-mono tracking-widest uppercase opacity-60">
                        Module Presentation
                    </div>
                    <div className="h-4 w-px bg-slate-900/10 dark:bg-white/10" />
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 text-xs font-semibold hover:bg-slate-900/10 dark:hover:bg-white/10 transition-colors"
                    >
                        <Icons.LayoutGrid className="h-3 w-3" />
                        Slide Index
                    </button>
                    <Link
                        href="/login"
                        className="hidden sm:flex items-center gap-1 px-4 py-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-transform hover:scale-105 active:scale-95"
                    >
                        Enter System
                        <Icons.ChevronRight className="h-3 w-3" />
                    </Link>
                </div>

                {/* Autoplay / Manual Progress indicator bar */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900/5 dark:bg-white/5">
                    <div 
                        className="h-full bg-cyan-500 transition-all duration-100 ease-linear"
                        style={{ width: isPlaying ? `${autoplayProgress}%` : `${((currentSlideIndex + 1) / SLIDES.length) * 100}%` }}
                    />
                </div>
            </header>

            {/* Interactive Navigation Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-16 right-6 z-40 w-80 p-4 rounded-2xl bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-white/10 shadow-2xl backdrop-blur-xl"
                    >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-900/10 dark:border-white/10">
                            <span className="text-xs font-black uppercase tracking-wider">Select Slide</span>
                            <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded-md hover:bg-slate-900/10 dark:hover:bg-white/10">
                                <Icons.X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {SLIDES.map((slide, idx) => {
                                const IconComponent = Icons[slide.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
                                const isActive = currentSlideIndex === idx;
                                return (
                                    <button
                                        key={slide.id}
                                        onClick={() => {
                                            setCurrentSlideIndex(idx);
                                            setAutoplayProgress(0);
                                            setIsMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                                            isActive 
                                                ? "bg-cyan-600 text-white font-bold" 
                                                : "hover:bg-slate-900/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400"
                                        }`}
                                    >
                                        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${isActive ? "bg-white/20" : "bg-slate-900/10 dark:bg-white/10"}`}>
                                            {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                                        </div>
                                        <span className="flex-1 truncate">{slide.title}</span>
                                        <span className="text-[10px] font-mono opacity-60">0{idx + 1}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Slide Body Canvas */}
            <main className="relative flex-1 z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 flex items-center justify-center overflow-y-auto min-h-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlideIndex}
                        initial={{ opacity: 0, x: 80, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -80, scale: 0.98 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full h-full flex items-center justify-center py-2"
                    >
                        {renderSlideContent()}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Bottom Controls Bar */}
            <footer className="relative z-30 px-6 py-4 flex items-center justify-between border-t border-slate-900/5 dark:border-white/5 bg-white/40 dark:bg-slate-950/20 backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={prevSlide}
                        disabled={currentSlideIndex === 0}
                        className="p-2 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                        <Icons.ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="p-2 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                        <Icons.ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="ml-2 text-xs font-mono tracking-widest text-slate-500 dark:text-slate-400">
                        {String(currentSlideIndex + 1).padStart(2, "0")} <span className="opacity-40">/</span> {String(SLIDES.length).padStart(2, "0")}
                    </div>
                </div>

                {/* Progress Indicators dots */}
                <div className="hidden md:flex items-center gap-1.5">
                    {SLIDES.map((slide, idx) => (
                        <button
                            key={slide.id}
                            onClick={() => {
                                setCurrentSlideIndex(idx);
                                setAutoplayProgress(0);
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                currentSlideIndex === idx ? "w-8 bg-cyan-500" : "w-2 bg-slate-900/20 dark:bg-white/20 hover:bg-cyan-500/50"
                            }`}
                            title={slide.title}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setIsPlaying(!isPlaying);
                            setAutoplayProgress(0);
                        }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-900/10 dark:border-white/10 text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                            isPlaying 
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" 
                                : "bg-slate-900/5 dark:bg-white/5 hover:bg-slate-900/10 dark:hover:bg-white/10"
                        }`}
                    >
                        {isPlaying ? (
                            <>
                                <Icons.Pause className="h-3 w-3 fill-current" />
                                Pause
                            </>
                        ) : (
                            <>
                                <Icons.Play className="h-3 w-3 fill-current" />
                                AutoPlay
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            const elem = document.documentElement;
                            if (!document.fullscreenElement) {
                                elem.requestFullscreen().catch((err) => console.log(err));
                            } else {
                                document.exitFullscreen().catch((err) => console.log(err));
                            }
                        }}
                        className="p-2 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 active:scale-95 transition-all hidden sm:block cursor-pointer"
                        title="Toggle Fullscreen"
                    >
                        <Icons.Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </footer>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 1: Title Slide (Hero)
// ----------------------------------------------------
function HeroSlide({ onStartPresentation }: { onStartPresentation: () => void }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full max-w-6xl text-left">
            <div className="lg:col-span-7 flex flex-col items-start space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-700 dark:text-cyan-400 text-xs font-semibold">
                    <Icons.Sparkles className="h-3 w-3 animate-pulse" />
                    Enterprise-Grade Financial Control
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight uppercase">
                    VOS ERP <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-rose-600 dark:from-cyan-400 dark:via-indigo-400 dark:to-rose-400">
                        Financial Operations
                    </span>
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl font-medium leading-relaxed">
                    A comprehensive, high-security financial hub integrating multi-tier consensus approvals, asset depreciation, dynamic auditing, and predictive AI insights for agile cash flow management.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button 
                        onClick={onStartPresentation}
                        className="rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-5 text-sm shadow-[0_4px_20px_-4px_rgba(6,182,212,0.4)] cursor-pointer"
                    >
                        Launch Tour
                        <Icons.ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button 
                        asChild
                        variant="outline" 
                        className="rounded-full border-slate-900/10 dark:border-white/10 bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 px-6 py-5 text-sm font-semibold cursor-pointer"
                    >
                        <Link href="/login">
                            Direct Login
                        </Link>
                    </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-6">
                    {[
                        { val: "13+", label: "Integrated Modules" },
                        { val: "100%", label: "Consensus Auditing" },
                        { val: "React 19", label: "Core Componentry" },
                        { val: "0ms", label: "Layout Shifts" },
                    ].map((metric, i) => (
                        <div key={i} className="p-3.5 rounded-2xl bg-white/30 dark:bg-slate-900/40 border border-slate-900/5 dark:border-white/5 backdrop-blur-sm">
                            <div className="text-xl font-black text-cyan-600 dark:text-cyan-400">{metric.val}</div>
                            <div className="text-[10px] uppercase font-bold tracking-wider opacity-60 mt-1">{metric.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-5 flex justify-center relative">
                {/* Volumetric Glowing Shield Visualizer */}
                <div className="relative w-72 h-72 sm:w-80 sm:h-80 select-none">
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20 dark:border-cyan-500/30 flex items-center justify-center"
                    />
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-8 rounded-full border border-dashed border-indigo-500/10 dark:border-indigo-500/20"
                    />
                    
                    {/* Glowing Center */}
                    <div className="absolute inset-16 rounded-full bg-gradient-to-tr from-cyan-600/10 to-indigo-600/10 dark:from-cyan-500/20 dark:to-indigo-500/20 blur-xl opacity-80" />
                    
                    <GlassCard 
                        accent="cyan" 
                        className="absolute inset-12 flex flex-col items-center justify-center p-6 text-center select-none"
                    >
                        <Icons.ShieldCheck className="h-16 w-16 text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.4)]" />
                        <span className="text-xs font-black tracking-widest uppercase mt-4 block text-slate-800 dark:text-slate-100">
                            VOS Integrity
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                            SHA-256 Verified
                        </span>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 2: Ecosystem Grid
// ----------------------------------------------------
const MODULES = [
    {
        title: "Treasury Management",
        desc: "Multi-level authorization, consensus mechanisms, and salesman expense collection flows.",
        icon: "Coins",
        tech: "Directus API, Hook Form",
        accent: "cyan" as const,
    },
    {
        title: "Asset Management",
        desc: "Interactive asset tracker, straight-line/declining depreciation models, barcode generator.",
        icon: "FileSpreadsheet",
        tech: "BarcodeJS, XLSX Import",
        accent: "indigo" as const,
    },
    {
        title: "Accounting System",
        desc: "General Ledger, Accounts Payable, automatic double-entry records, and VAT processing.",
        icon: "Calculator",
        tech: "TanStack Table, Zod",
        accent: "violet" as const,
    },
    {
        title: "Financial Statements",
        desc: "Dynamically compile Balance Sheets, Profit & Loss reports, and Statements of Cash Flow.",
        icon: "TrendingUp",
        tech: "Recharts, jsPDF AutoTable",
        accent: "emerald" as const,
    },
    {
        title: "Supplier Registration",
        desc: "KYC onboarding, TIN checks, tax category structures, and representative management.",
        icon: "Users",
        tech: "Image Compress, Zod Form",
        accent: "rose" as const,
    },
    {
        title: "Pricing & Costing",
        desc: "Dynamic pricing builders, cost-plus margins, and commodity tracking matrix.",
        icon: "DollarSign",
        tech: "Directus, Math Logic",
        accent: "amber" as const,
    },
];

function EcosystemSlide() {
    return (
        <div className="w-full max-w-6xl space-y-6 text-left">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                        Architectural Scope
                    </span>
                    <h2 className="text-3xl font-black uppercase mt-1">
                        Unified Module Ecosystem
                    </h2>
                </div>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md font-medium leading-relaxed">
                    Designed as a modular, decoupled workspace. Standardized UI primitives are combined with micro-applications to support various functional silos.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MODULES.map((mod, i) => {
                    const IconComponent = Icons[mod.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
                    return (
                        <GlassCard 
                            key={i} 
                            accent={mod.accent}
                            className="p-6 flex flex-col justify-between h-56 group select-none text-left"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300">
                                        {IconComponent && <IconComponent className="h-5 w-5" />}
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                                        {mod.tech}
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                                    {mod.title}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                                    {mod.desc}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1.5 transition-transform duration-300 mt-2">
                                Details <Icons.ArrowRight className="h-3 w-3" />
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 3: Treasury Bulk Approval Consensus (Simulation)
// ----------------------------------------------------
function TreasurySlide() {
    const [draftAmount, setDraftAmount] = React.useState(4500);
    const [currentStep, setCurrentStep] = React.useState(0); // 0: L1, 1: L2, 2: L3, 3: Completed
    const [logs, setLogs] = React.useState<string[]>([
        "System: Disbursement draft #DD-2026-089 generated.",
        "System: Status set to Pending_L1 (Consensus Required)."
    ]);

    const steps = [
        { id: "L1", label: "Level 1 (Supervisor)", role: "Supervisor" },
        { id: "L2", label: "Level 2 (Dept Head)", role: "Dept Head" },
        { id: "L3", label: "Level 3 (VP Finance)", role: "VP Finance" }
    ];

    const approveLevel = (levelId: string) => {
        setLogs(prev => [
            ...prev,
            `Audit: ${levelId} voted APPROVED (Amount: $${draftAmount.toFixed(2)})`
        ]);

        if (currentStep < 2) {
            setCurrentStep(prev => prev + 1);
            setLogs(prev => [
                ...prev,
                `System: Draft advanced to Pending_${steps[currentStep + 1].id}.`
            ]);
        } else {
            setCurrentStep(3);
            setLogs(prev => [
                ...prev,
                "System: 100% Consensus reached! Status -> Approved.",
                "System: Live disbursement registered. Assigned Doc: NT-1001."
            ]);
        }
    };

    const adjustAmount = () => {
        const reduction = 450;
        const oldAmount = draftAmount;
        const newAmount = draftAmount - reduction;
        setDraftAmount(newAmount);
        setLogs(prev => [
            ...prev,
            `Variance Log: L${currentStep + 1} adjusted amount from $${oldAmount.toFixed(2)} to $${newAmount.toFixed(2)}. Incrementing draft version to v2.`
        ]);
    };

    const resetSimulator = () => {
        setDraftAmount(4500);
        setCurrentStep(0);
        setLogs([
            "System: Disbursement draft #DD-2026-089 generated.",
            "System: Status set to Pending_L1 (Consensus Required)."
        ]);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full max-w-6xl text-left select-none">
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                        Risk & Audits
                    </span>
                    <h2 className="text-3xl font-black uppercase mt-1">
                        Consensus Approvals
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                        Treasury disbursement drafts demand sequential, 100% consensus approvals per level to mitigate fraud and optimize cash outflows.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 text-xs font-bold">1</div>
                        <div>
                            <h4 className="text-xs font-black uppercase">Strict Consensual Agreement</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Every authorized approver at the active tier must sign off before the draft can escalate to the next tier.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 text-xs font-bold">2</div>
                        <div>
                            <h4 className="text-xs font-black uppercase">Variance Snapshots</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">If an approver modifies the payout amount, a variance log is filed, resetting consensus requirements for security.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 text-xs font-bold">3</div>
                        <div>
                            <h4 className="text-xs font-black uppercase">Conversion to Live Doc</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Upon final tier clearance, the draft converts into a permanent ledger entry with an audited sequence number.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
                <GlassCard accent="indigo" className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-3">
                            <div>
                                <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                                    Simulating Draft #DD-2026-089
                                </span>
                            </div>
                            <button 
                                onClick={resetSimulator}
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                            >
                                <Icons.RefreshCw className="h-3 w-3" /> Reset
                            </button>
                        </div>

                        {/* Visual Workflow Steps */}
                        <div className="grid grid-cols-3 gap-2">
                            {steps.map((s, idx) => {
                                const isActive = currentStep === idx;
                                const isPassed = currentStep > idx;
                                return (
                                    <div 
                                        key={s.id} 
                                        className={`p-3 rounded-xl border text-center transition-all ${
                                            isActive 
                                                ? "border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-500/10" 
                                                : isPassed 
                                                ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5 opacity-80"
                                                : "border-slate-900/5 dark:border-white/5 bg-slate-900/[0.02] dark:bg-white/[0.01] opacity-50"
                                        }`}
                                    >
                                        <div className="flex justify-center mb-1">
                                            {isPassed ? (
                                                <Icons.CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <Icons.User className={`h-4 w-4 ${isActive ? "text-cyan-500" : ""}`} />
                                            )}
                                        </div>
                                        <div className="text-[10px] font-black uppercase truncate">{s.label}</div>
                                        <div className="text-[9px] opacity-60 truncate">{s.role}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Active Panel */}
                        <div className="p-4 rounded-2xl bg-slate-900/5 dark:bg-slate-950/40 border border-slate-900/5 dark:border-white/5 space-y-4">
                            <div className="flex items-center justify-between text-xs font-mono">
                                <div>
                                    <span className="opacity-60 uppercase block text-[9px] tracking-wider font-bold">Draft Balance:</span>
                                    <span className="text-lg font-black text-slate-800 dark:text-white">${draftAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-right">
                                    <span className="opacity-60 uppercase block text-[9px] tracking-wider font-bold">Status:</span>
                                    <span className={`font-black uppercase tracking-wider ${currentStep === 3 ? "text-emerald-500" : "text-cyan-500"}`}>
                                        {currentStep === 3 ? "APPROVED" : `PENDING_${steps[currentStep].id}`}
                                    </span>
                                </div>
                            </div>

                            {/* Simulation buttons */}
                            {currentStep < 3 ? (
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => approveLevel(steps[currentStep].id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                                    >
                                        <Icons.Check className="h-3.5 w-3.5" /> Approve L{currentStep + 1}
                                    </button>
                                    <button 
                                        onClick={adjustAmount}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 active:scale-95 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
                                    >
                                        <Icons.Settings2 className="h-3.5 w-3.5" /> Adjust (-$450)
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2">
                                    <Icons.CheckCircle2 className="h-4 w-4" /> Final Clearance Granted. Recorded Live!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Console Log Screen */}
                    <div className="h-28 mt-4 p-2.5 rounded-xl bg-slate-950 border border-white/5 text-emerald-500 font-mono text-[9px] overflow-y-auto leading-relaxed select-text">
                        {logs.slice().reverse().map((log, i) => (
                            <div key={i} className="flex gap-1">
                                <span className="opacity-40">[{new Date().toLocaleTimeString()}]</span>
                                <span>{log}</span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 4: Accounts Payable & AI-Insights
// ----------------------------------------------------
const AGING_PAYABLES = [
    { label: "0-30 Days", val: 12400, desc: "Immediate payables", color: "bg-cyan-500" },
    { label: "31-60 Days", val: 8200, desc: "Standard credit terms", color: "bg-indigo-500" },
    { label: "61-90 Days", val: 3500, desc: "Pending disputes", color: "bg-violet-500" },
    { label: "90+ Days", val: 1200, desc: "Overdue escalation", color: "bg-rose-500" },
];

function PayablesSlide() {
    const [selectedBucket, setSelectedBucket] = React.useState<number | null>(null);
    const [aiTyping, setAiTyping] = React.useState(false);
    const [insights, setInsights] = React.useState<string[]>([]);

    const runAiAudit = () => {
        setAiTyping(true);
        setInsights([]);
        setTimeout(() => {
            setAiTyping(false);
            setInsights([
                "💡 Optimization Opportunity: supplier TechCorp offers a 2/10 Net 30 terms. Paying invoice #TC-789 by tomorrow saves $248.00.",
                "⚠️ Aging Risk Alert: invoices amounting to $1,200 in the 90+ bucket are accruing late fees. Advise early release of disbursement #DD-129.",
                "🔒 Fraud Detection Safeguard: matched potential duplicate draft between invoice #8892 and #8893 ($350.00). Hold for manual audit."
            ]);
        }, 1500);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full max-w-6xl text-left select-none">
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                        Intelligent Ledgers
                    </span>
                    <h2 className="text-3xl font-black uppercase mt-1">
                        Accounts Payable
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                        Analyze payables distribution by credit age buckets. Deep-dive invoice queues and let the integrated AI Audit Engine optimize payments.
                    </p>
                </div>

                {/* Aging Graph Visual */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aging Payables Breakdown</span>
                    <div className="space-y-2">
                        {AGING_PAYABLES.map((bucket, i) => {
                            const maxVal = 13000;
                            const pct = (bucket.val / maxVal) * 100;
                            const isSelected = selectedBucket === i;
                            return (
                                <div 
                                    key={i} 
                                    onClick={() => setSelectedBucket(isSelected ? null : i)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected 
                                            ? "border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-500/10 shadow-sm" 
                                            : "border-slate-900/5 dark:border-white/5 hover:bg-slate-900/5 dark:hover:bg-white/5 bg-white/20 dark:bg-slate-950/20"
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="font-bold">{bucket.label}</span>
                                        <div className="font-mono font-black text-slate-800 dark:text-white">
                                            ${bucket.val.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-900/5 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${bucket.color} rounded-full`} style={{ width: `${pct}%` }} />
                                    </div>
                                    {isSelected && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                                            ℹ️ {bucket.desc}. Active payables are held securely under validation checks.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-5 flex flex-col">
                <GlassCard accent="violet" className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-3">
                            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Icons.Sparkles className="h-4.5 w-4.5 text-violet-500 animate-pulse" />
                                AI Audit Engine
                            </h3>
                            <span className="text-[9px] font-mono bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
                                LLM 3.5 Ready
                            </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                            Execute real-time auditing of current AP records. The AI scans vendor parameters, payment terms, and past disbursement structures to optimize cash out-flows.
                        </p>

                        <button 
                            onClick={runAiAudit}
                            disabled={aiTyping}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                        >
                            <Icons.Activity className="h-3.5 w-3.5" /> Run AI Audit Scan
                        </button>

                        <div className="border border-slate-900/10 dark:border-white/10 rounded-2xl min-h-[160px] p-4 bg-slate-900/[0.02] dark:bg-slate-950/40 relative">
                            {aiTyping && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xs rounded-2xl">
                                    <Icons.Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 animate-pulse">Auditing Accounts Payable...</span>
                                </div>
                            )}

                            {insights.length === 0 && !aiTyping ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-8 opacity-40">
                                    <Icons.Brain className="h-8 w-8 text-slate-400 mb-2" />
                                    <span className="text-[11px] font-semibold">No audit insights generated yet. Click Scan to run.</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {insights.map((insight, idx) => (
                                        <div key={idx} className="p-2.5 rounded-xl border border-violet-500/10 bg-violet-500/5 text-[10px] font-medium leading-normal text-slate-700 dark:text-slate-300">
                                            {insight}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-[9px] font-mono opacity-40 text-center mt-4">
                        Powered by VOS AI Services • Scopes cached for 60 seconds
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 5: Cash Flow Forecasting
// ----------------------------------------------------
const CASH_DATA = [
    { month: "Jan", inflow: 45000, outflow: 32000 },
    { month: "Feb", inflow: 52000, outflow: 38000 },
    { month: "Mar", inflow: 49000, outflow: 41000 },
    { month: "Apr", inflow: 61000, outflow: 43000 },
    { month: "May", inflow: 58000, outflow: 49000 },
    { month: "Jun", inflow: 68000, outflow: 45000 },
];

function CashFlowSlide() {
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full max-w-6xl text-left select-none">
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                        Predictive Insights
                    </span>
                    <h2 className="text-3xl font-black uppercase mt-1">
                        Cash Flow Intelligence
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                        Monitor net working capital trends. High-fidelity visuals map cash inflows against operating expenditures, feeding predictive models for cash runaway metrics.
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/20 dark:bg-slate-950/20 border border-slate-900/5 dark:border-white/5 space-y-3 font-medium text-xs">
                    <div className="flex justify-between items-center">
                        <span className="opacity-60">Avg. Monthly Inflow:</span>
                        <span className="font-bold font-mono">$55,500</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="opacity-60">Avg. Monthly Outflow:</span>
                        <span className="font-bold font-mono">$41,333</span>
                    </div>
                    <div className="h-px bg-slate-900/10 dark:bg-white/10 my-1" />
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Net Surplus position:</span>
                        <span className="font-mono">+$14,167</span>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
                <GlassCard accent="emerald" className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black uppercase tracking-wider">H1 cash trends (Inflow vs Outflow)</span>
                            <div className="flex gap-3 text-[10px] font-bold">
                                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 inline-block" /> Inflow</span>
                                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-cyan-500 inline-block" /> Outflow</span>
                            </div>
                        </div>

                        {/* Interactive SVG Chart */}
                        <div className="relative h-52 w-full mt-4 flex items-end">
                            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/>
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                                    </linearGradient>
                                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4"/>
                                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0"/>
                                    </linearGradient>
                                </defs>

                                {/* Gridlines */}
                                <line x1="0" y1="50" x2="600" y2="50" stroke="currentColor" strokeOpacity="0.05" />
                                <line x1="0" y1="100" x2="600" y2="100" stroke="currentColor" strokeOpacity="0.05" />
                                <line x1="0" y1="150" x2="600" y2="150" stroke="currentColor" strokeOpacity="0.05" />

                                {/* Area Paths */}
                                {/* Inflow Area */}
                                <path 
                                    d="M 50 200 L 50 80 L 150 62 L 250 70 L 350 42 L 450 48 L 550 25 L 550 200 Z" 
                                    fill="url(#inflowGrad)" 
                                />
                                <path 
                                    d="M 50 80 L 150 62 L 250 70 L 350 42 L 450 48 L 550 25" 
                                    fill="none" 
                                    stroke="#10b981" 
                                    strokeWidth="3" 
                                />

                                {/* Outflow Area */}
                                <path 
                                    d="M 50 200 L 50 110 L 150 96 L 250 88 L 350 84 L 450 72 L 550 80 L 550 200 Z" 
                                    fill="url(#outflowGrad)" 
                                />
                                <path 
                                    d="M 50 110 L 150 96 L 250 88 L 350 84 L 450 72 L 550 80" 
                                    fill="none" 
                                    stroke="#06b6d4" 
                                    strokeWidth="3" 
                                />
                            </svg>

                            {/* Chart Interactive Bars overlay for hovering */}
                            <div className="absolute inset-0 flex justify-between px-6 pt-4">
                                {CASH_DATA.map((d, i) => (
                                    <div 
                                        key={i}
                                        onMouseEnter={() => setHoverIndex(i)}
                                        onMouseLeave={() => setHoverIndex(null)}
                                        className="w-16 h-full flex flex-col justify-end items-center cursor-pointer relative"
                                    >
                                        {/* Grid node glow */}
                                        <div className={`w-[2px] h-full absolute left-1/2 -translate-x-1/2 bg-white/5 transition-opacity ${hoverIndex === i ? "opacity-100" : "opacity-0"}`} />
                                    </div>
                                ))}
                            </div>

                            {/* Month Axis Labels */}
                            <div className="absolute bottom-[-24px] left-0 right-0 flex justify-between px-6 text-[10px] font-bold opacity-60">
                                {CASH_DATA.map((d) => <span key={d.month}>{d.month}</span>)}
                            </div>
                        </div>

                        {/* Tooltip output */}
                        <div className="mt-8 h-12 flex items-center justify-between p-3 rounded-xl bg-slate-900/5 dark:bg-slate-950/40 border border-slate-900/5 dark:border-white/5 text-[10px]">
                            {hoverIndex !== null ? (
                                <>
                                    <div>
                                        <span className="opacity-50 block uppercase text-[8px] font-bold">Month:</span>
                                        <span className="font-bold text-slate-800 dark:text-white">{CASH_DATA[hoverIndex].month} 2026</span>
                                    </div>
                                    <div>
                                        <span className="opacity-50 block uppercase text-[8px] font-bold">Cash Inflow:</span>
                                        <span className="font-bold text-emerald-500">${CASH_DATA[hoverIndex].inflow.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="opacity-50 block uppercase text-[8px] font-bold">Operating Outflow:</span>
                                        <span className="font-bold text-cyan-500">${CASH_DATA[hoverIndex].outflow.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="opacity-50 block uppercase text-[8px] font-bold">Net Position:</span>
                                        <span className="font-bold text-slate-800 dark:text-white">+${(CASH_DATA[hoverIndex].inflow - CASH_DATA[hoverIndex].outflow).toLocaleString()}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center w-full opacity-60 font-medium italic">
                                    Hover over the data points in the chart for exact monthly values.
                                </div>
                            )}
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 6: Architecture / Tech Stack
// ----------------------------------------------------
const TECH_GROUPS = [
    {
        title: "Frontend Engine",
        items: [
            { name: "Next.js 16 (App Router)", detail: "Decoupled route modules" },
            { name: "React 19 Core", detail: "Optimized concurrent updates" },
            { name: "Tailwind CSS 4", detail: "Fast UI design engine" },
            { name: "Framer Motion 12", detail: "Smooth transition systems" },
        ],
        icon: "LayoutGrid"
    },
    {
        title: "Data & Security Stack",
        items: [
            { name: "TypeScript 5", detail: "Type-safe financial calculations" },
            { name: "Zod Schema", detail: "Zero-injection form sanitization" },
            { name: "Zustand Store", detail: "Lightweight state cache" },
            { name: "Directus API", detail: "Automated CMS integration" },
        ],
        icon: "ShieldAlert"
    },
    {
        title: "Reporting & Utilities",
        items: [
            { name: "jsPDF / AutoTable", detail: "Clean client-side PDF prints" },
            { name: "SheetJS (XLSX)", detail: "Fast spreadsheet imports" },
            { name: "QR-code parser", detail: "Receipt checking automation" },
            { name: "Zod Validators", detail: "TIN verification checks" },
        ],
        icon: "FileSignature"
    }
];

function ArchitectureSlide() {
    return (
        <div className="w-full max-w-6xl space-y-6 text-left select-none">
            <div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                    System Architecture
                </span>
                <h2 className="text-3xl font-black uppercase mt-1">
                    System Tech Stack
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed font-medium">
                    The platform coordinates Next.js App routing with custom React 19 components and a headless CMS backend. Strict validation and fast rendering maintain system reliability.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TECH_GROUPS.map((grp, i) => {
                    const IconComponent = Icons[grp.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
                    return (
                        <GlassCard key={i} accent="cyan" className="p-6 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-900/10 dark:border-white/10 pb-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-900/5 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                    {IconComponent && <IconComponent className="h-4 w-4" />}
                                </div>
                                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                                    {grp.title}
                                </h3>
                            </div>
                            <div className="space-y-4 flex-1">
                                {grp.items.map((item, idx) => (
                                    <div key={idx} className="space-y-0.5">
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                                            {item.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5 leading-relaxed font-medium">
                                            {item.detail}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 7: Live Simulator Sandbox
// ----------------------------------------------------
function SandboxSlide() {
    const [terminalLogs, setTerminalLogs] = React.useState<string[]>([
        "Terminal loaded. Ready for simulation inputs."
    ]);
    const [simulating, setSimulating] = React.useState<string | null>(null);

    const logMessage = (msg: string) => {
        setTerminalLogs(prev => [...prev, msg]);
    };

    const runAction = (type: string) => {
        if (simulating) return;
        setSimulating(type);
        
        if (type === "tin") {
            logMessage("User triggered: Security & TIN Scan");
            logMessage("Scan: Fetching active supplier directory...");
            setTimeout(() => {
                logMessage("Scan: Querying TIN registry server...");
                setTimeout(() => {
                    logMessage("Scan Success: TIN valid. Zero fraud risk flagged.");
                    setSimulating(null);
                }, 800);
            }, 600);
        } else if (type === "receipt") {
            logMessage("User triggered: Receipts Processing");
            logMessage("Processor: Compressing uploaded image files...");
            setTimeout(() => {
                logMessage("Processor: Image optimized. Calling Zod validator...");
                setTimeout(() => {
                    logMessage("Processor Success: Data compiled into disbursement draft #DD-132.");
                    setSimulating(null);
                }, 800);
            }, 600);
        } else if (type === "consensus") {
            logMessage("User triggered: Consensus Validation");
            logMessage("Consensus: Level 1 and Level 2 approval flags loaded.");
            setTimeout(() => {
                logMessage("Consensus Warning: L3 adjusted amount. Version incremented to v2.");
                setTimeout(() => {
                    logMessage("Consensus: Draft recycled back to Level 1. Reset completed.");
                    setSimulating(null);
                }, 800);
            }, 600);
        } else if (type === "pdf") {
            logMessage("User triggered: PDF Statement Export");
            logMessage("PDF: Initializing jsPDF layouts & AutoTable rows...");
            setTimeout(() => {
                logMessage("PDF: Generating vector structure and download payload...");
                setTimeout(() => {
                    logMessage("PDF Success: File converted. Streamed to browser download.");
                    setSimulating(null);
                }, 800);
            }, 600);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full max-w-6xl text-left select-none">
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
                        Interactive Testing
                    </span>
                    <h2 className="text-3xl font-black uppercase mt-1">
                        Operation Sandbox
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">
                        Simulate background pipeline operations in real-time. Trigger validation mechanisms, audits, or PDF rendering to trace internal logs.
                    </p>
                </div>

                {/* Simulated Button Controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                        { label: "TIN Scan", type: "tin", icon: "ShieldCheck" },
                        { label: "Process Receipts", type: "receipt", icon: "FileText" },
                        { label: "Consensus Check", type: "consensus", icon: "UserCheck" },
                        { label: "Generate PDF", type: "pdf", icon: "FileDown" },
                    ].map((btn, i) => {
                        const IconComponent = Icons[btn.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>;
                        const active = simulating === btn.type;
                        return (
                            <button
                                key={i}
                                onClick={() => runAction(btn.type)}
                                disabled={simulating !== null}
                                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                                    active 
                                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" 
                                        : "border-slate-900/10 dark:border-white/5 hover:bg-slate-900/5 dark:hover:bg-white/5 bg-white/20 dark:bg-slate-950/20"
                                }`}
                            >
                                <div className="h-6 w-6 rounded-md bg-slate-900/5 dark:bg-white/5 flex items-center justify-center">
                                    {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                                </div>
                                <span>{btn.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
                <GlassCard accent="rose" className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-3">
                            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Icons.Terminal className="h-4.5 w-4.5 text-rose-500" />
                                Logs Monitor
                            </span>
                            {simulating && (
                                <span className="flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 font-bold animate-pulse">
                                    <Icons.Loader2 className="h-3 w-3 animate-spin" /> Running Pipeline...
                                </span>
                            )}
                        </div>

                        {/* Monospace terminal logs */}
                        <div className="h-[260px] p-4 rounded-2xl bg-slate-950 border border-white/5 text-rose-400 font-mono text-[10px] overflow-y-auto leading-relaxed select-text flex flex-col justify-end">
                            <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                                {terminalLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <span className="text-slate-600 select-none">&gt;</span>
                                        <span>{log}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// SLIDE 8: Value Delivery & Conclusion
// ----------------------------------------------------
function ConclusionSlide({ onRestart }: { onRestart: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center text-center max-w-4xl space-y-8 select-none py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <Icons.CheckCircle2 className="h-3.5 w-3.5" />
                Delivery Phase Clear
            </div>

            <div className="space-y-3">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight">
                    Premium Financial Control
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-medium leading-relaxed">
                    By combining strict type systems, dual-factor authentication, consensus approvals, and AI Insights, VOS ERP provides next-generation security and efficiency.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl pt-2">
                {[
                    { title: "Audit Ready", desc: "100% structured logging of user decisions, approval drafts, and transaction changes." },
                    { title: "Speed & Perf", desc: "Decoupled Next.js routing and preloaded components guarantee 0ms layout shifts." },
                    { title: "Smart Logic", desc: "Dynamic pricing templates, AP filters, and automated TIN scanning reduce overhead." },
                ].map((item, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/20 dark:bg-slate-950/20 border border-slate-900/5 dark:border-white/5 text-left space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white">{item.title}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 pt-4">
                <Button 
                    asChild
                    className="rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-5 text-sm shadow-[0_4px_20px_-4px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                    <Link href="/login">
                        Enter Workspace
                    </Link>
                </Button>
                <Button 
                    onClick={onRestart}
                    variant="outline" 
                    className="rounded-full border-slate-900/10 dark:border-white/10 bg-white/20 dark:bg-white/5 hover:bg-white/40 dark:hover:bg-white/10 px-6 py-5 text-sm font-semibold cursor-pointer"
                >
                    Restart Tour
                </Button>
            </div>
        </div>
    );
}
