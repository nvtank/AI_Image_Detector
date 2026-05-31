"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";
import { useLanguage } from "@/context/LanguageContext";

type LocalModelResult = {
  predicted_label: string;
  confidence: number;
  fake_probability: number;
  real_probability: number;
  model_name: string;
  processing_time_ms: number;
};

type GeminiAnalysis = {
  predicted_label: string;
  confidence_score: number;
  confidence_level: string;
  evidence_for_fake: string[];
  evidence_for_real: string[];
  uncertainty_reasons: string[];
  reasoning_summary: string;
  recommendation: string;
  should_trust_result: boolean;
  error?: boolean;
  visual_signals?: string[];
  limitations?: string;
};

type HybridPredictResult = {
  final_decision: string;
  agreement_status: string;
  local_model: LocalModelResult;
  gemini_analysis?: GeminiAnalysis;
  recommendation: string;
  image_url?: string;
  thumbnail_url?: string;
  cloudinary_warning?: string;
};

// Pipeline stage animation config (icons + keys only; labels resolved inside component)
const PIPELINE_STAGE_KEYS = [
  { key: "PREPROCESSING",   icon: "🖼️",  labelKey: "upload.preprocessing" },
  { key: "LOCAL_INFERENCE", icon: "🧠",  labelKey: "upload.pytorchModel" },
  { key: "GEMINI_ANALYSIS", icon: "✨",  labelKey: "upload.geminiAI" },
  { key: "COMBINING",       icon: "⚡",  labelKey: "upload.hybridDecision" },
  { key: "SUCCESS",         icon: "✅",  labelKey: "upload.done" },
];

// Polling interval in ms
const POLL_INTERVAL = 2000;

function UploadContent() {
  const { t } = useLanguage();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [useGemini, setUseGemini] = useState(true);
  const [useAsync, setUseAsync] = useState(true);  // Phase 3: async mode
  const [result, setResult] = useState<HybridPredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Async polling state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStage, setTaskStage] = useState<string>("PENDING");
  const [taskLabel, setTaskLabel] = useState<string>("");
  const [taskPercent, setTaskPercent] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase 5: WebSocket notification hooks
  const { subscribeToTask, onTaskProgress, onTaskComplete, onTaskFailed, isConnected } =
    useNotifications();
  // Track active task for WS event dedup
  const activeTaskRef = useRef<string | null>(null);

  // Resolve pipeline stage labels using t()
  const PIPELINE_STAGES = useMemo(() =>
    PIPELINE_STAGE_KEYS.map((s) => ({
      key: s.key,
      icon: s.icon,
      label: t(s.labelKey),
    })),
    [t]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Register WS listeners for task events
  useEffect(() => {
    const unsubProgress = onTaskProgress((tid, stage, label, percent) => {
      if (tid !== activeTaskRef.current) return;
      setTaskStage(stage.toUpperCase());
      setTaskLabel(label);
      setTaskPercent(percent);
    });

    const unsubComplete = onTaskComplete((tid, taskResult) => {
      if (tid !== activeTaskRef.current) return;
      stopPolling(); // Stop HTTP polling — WS delivered the result
      setResult(taskResult as HybridPredictResult);
      setIsLoading(false);
      setTaskId(null);
      activeTaskRef.current = null;
    });

    const unsubFailed = onTaskFailed((tid, taskError) => {
      if (tid !== activeTaskRef.current) return;
      stopPolling();
      setError(taskError || t('upload.analysisFailed'));
      setIsLoading(false);
      setTaskId(null);
      activeTaskRef.current = null;
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubFailed();
    };
  }, [onTaskProgress, onTaskComplete, onTaskFailed, stopPolling, t]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError(t('upload.invalidImage'));
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setError(null);
    setTaskId(null);
    setTaskStage("PENDING");
    setTaskPercent(0);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const clearSelection = () => {
    stopPolling();
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setTaskId(null);
    setTaskStage("PENDING");
    setTaskPercent(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelTask = async () => {
    if (!taskId) return;
    stopPolling();
    try {
      await api.cancelTask(taskId);
    } catch {}
    setTaskId(null);
    setIsLoading(false);
    setTaskStage("PENDING");
    setTaskLabel("");
    setTaskPercent(0);
  };

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const status = await api.getTaskStatus(id);
        setTaskStage(status.state);
        setTaskLabel(status.label);
        setTaskPercent(status.percent);

        if (status.state === "SUCCESS" && status.result) {
          stopPolling();
          setResult(status.result as HybridPredictResult);
          setIsLoading(false);
          setTaskId(null);
        } else if (status.state === "FAILURE") {
          stopPolling();
          setError(status.error || t('upload.analysisFailed'));
          setIsLoading(false);
          setTaskId(null);
        }
      } catch {
        // Network blip — keep polling
      }
    }, POLL_INTERVAL);
  }, [stopPolling, t]);

  const analyzeImage = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      if (useAsync && useGemini) {
        // ── Phase 3 + 5: Async mode + WebSocket progress ──────────────
        const queued = await api.uploadImageHybridAsync(file, true);
        setTaskId(queued.task_id);
        activeTaskRef.current = queued.task_id;  // Register for WS events
        setTaskStage("PENDING");
        setTaskLabel(t('upload.queuing'));
        setTaskPercent(5);

        // Phase 5: Subscribe to WebSocket updates for this task
        subscribeToTask(queued.task_id);

        // Phase 3 fallback: HTTP polling (runs in parallel, WS events take priority)
        startPolling(queued.task_id);

      } else if (useGemini) {
        // ── Sync hybrid (legacy, backward compat) ────────────────────
        const data = await api.uploadImageHybrid(file, true);
        setResult(data);
        setIsLoading(false);
      } else {
        // ── Local model only (fast, sync) ─────────────────────────────
        const data = await api.uploadImage(file);
        setResult({
          final_decision: data.label,
          agreement_status: "gemini_unavailable",
          local_model: {
            predicted_label: data.label,
            confidence: data.confidence,
            fake_probability: data.fake_probability,
            real_probability: data.real_probability,
            model_name: data.model_name,
            processing_time_ms: data.processing_time_ms,
          },
          recommendation: t('upload.geminiUnavailable'),
          image_url: data.image_url,
          thumbnail_url: data.thumbnail_url,
          cloudinary_warning: data.cloudinary_warning,
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || t('upload.error'));
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-16 px-4">
      {/* Page Header */}
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
          {t('upload.title')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
          {t('upload.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload & Options (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* File Drag and Drop */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 p-8 flex flex-col items-center justify-center text-center min-h-[300px]
              ${isDragging ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50"}
              ${!preview ? "cursor-pointer hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/20" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !preview && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {preview ? (
              <div className="w-full flex flex-col items-center">
                <div className="relative w-full aspect-square max-h-[260px] rounded-xl overflow-hidden mb-5 shadow-md border border-slate-200/60 dark:border-slate-850">
                  <Image src={preview} alt="Preview" fill className="object-contain" />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {t('upload.clear')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                  >
                    {t('upload.change')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none select-none">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-full mb-4 text-indigo-600 dark:text-indigo-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">{t('upload.dragTitle')}</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('upload.dragFormats')}</p>
              </div>
            )}
          </div>

          {/* Gemini Option Toggle */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
            <div className="flex flex-col gap-1 pr-4">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                ✨ {t('upload.geminiTitle')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                {t('upload.geminiDesc')}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useGemini}
                onChange={() => setUseGemini(!useGemini)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650" />
            </label>
          </div>

          {/* Phase 3: Async Mode Toggle */}
          {useGemini && (
            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-sm">
                  ⚡ {t('upload.asyncTitle')}
                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/15 text-indigo-500 rounded font-bold">Phase 3</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('upload.asyncDesc')}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useAsync}
                  onChange={() => setUseAsync(!useAsync)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500" />
              </label>
            </div>
          )}

          {/* Trigger + Cancel buttons */}
          <div className="flex gap-3">
            <button
              onClick={analyzeImage}
              disabled={!file || isLoading}
              className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all flex justify-center items-center gap-2.5 shadow-sm
                ${!file || isLoading ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-md transform active:scale-[0.99]"}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {taskId ? t('upload.processing') : t('upload.uploading')}
                </>
              ) : t('upload.analyze')}
            </button>
            {taskId && isLoading && (
              <button
                onClick={cancelTask}
                className="px-4 py-4 rounded-2xl font-semibold text-sm text-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/50 transition-colors"
                title={t('upload.cancel')}
              >
                ✕ {t('upload.cancel')}
              </button>
            )}
          </div>

          {/* Phase 3: Async Pipeline Progress */}
          {isLoading && taskId && (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">⚡ {t('upload.asyncPipeline')}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    isConnected
                      ? "bg-green-400/15 text-green-400"
                      : "bg-slate-700 text-slate-400"
                  }`}>
                    {isConnected ? "🟢 WebSocket" : "🔄 Polling"}
                  </span>
                  <span className="text-xs text-slate-400">{taskPercent}%</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${taskPercent}%` }}
                />
              </div>
              {/* Stage steps */}
              <div className="flex justify-between">
                {PIPELINE_STAGES.map((stage) => {
                  const stageOrder = ["PREPROCESSING", "LOCAL_INFERENCE", "GEMINI_ANALYSIS", "COMBINING", "SUCCESS"];
                  const currentIdx = stageOrder.indexOf(taskStage);
                  const stageIdx = stageOrder.indexOf(stage.key);
                  const isDone = currentIdx > stageIdx;
                  const isActive = currentIdx === stageIdx;
                  return (
                    <div key={stage.key} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                        isDone ? "bg-green-100 dark:bg-green-900/40 text-green-600" :
                        isActive ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 ring-2 ring-indigo-400 animate-pulse" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        {stage.icon}
                      </div>
                      <span className={`text-[9px] font-medium text-center leading-tight ${
                        isDone ? "text-green-600 dark:text-green-400" :
                        isActive ? "text-indigo-600 dark:text-indigo-400" :
                        "text-slate-400"
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Current stage label */}
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic">{taskLabel}</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/30 text-sm leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Unified Results stack (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {result ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
              
              {/* 1. Final Decision Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className={`p-6 text-center border-b flex flex-col items-center
                  ${result.final_decision === "FAKE" ? "bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/20" :
                    result.final_decision === "REAL" ? "bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/20" :
                    "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20"}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {t('upload.finalDecision')}
                  </p>
                  <h2 className={`text-4xl font-extrabold tracking-wide mb-2
                    ${result.final_decision === "FAKE" ? "text-red-600 dark:text-red-500" :
                      result.final_decision === "REAL" ? "text-green-600 dark:text-green-500" :
                      "text-amber-500 dark:text-amber-400"}`}
                  >
                    {result.final_decision}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm inline-block
                    ${result.agreement_status === "agree" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" :
                      result.agreement_status === "disagree" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                  >
                    {result.agreement_status === "agree" ? `✓ ${t('upload.agree')}` :
                     result.agreement_status === "disagree" ? `⚠ ${t('upload.disagree')}` :
                     `ℹ ${t('upload.geminiUnavailable')}`}
                  </span>
                </div>
                
                <div className="p-6 bg-slate-50/30 dark:bg-slate-900/30">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-350 mb-1">{t('upload.recommendation')}:</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-150 dark:border-slate-850">
                    &quot;{result.recommendation}&quot;
                  </p>
                </div>
              </div>

              {/* Grid for Local Model & Gemini cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2. Local Model Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{t('upload.localModel')}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase
                      ${result.local_model.predicted_label === "FAKE" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"}`}
                    >
                      {result.local_model.predicted_label}
                    </span>
                  </div>

                  <div className="text-center mb-5">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">{t('upload.confidence')}</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-150">
                      {(result.local_model.confidence * 100).toFixed(2)}%
                    </span>
                  </div>

                  {/* Probability bars */}
                  <div className="space-y-3.5 flex-grow">
                    {[
                      { label: t('upload.fakeProb'), val: result.local_model.fake_probability, color: "bg-red-500" },
                      { label: t('upload.realProb'), val: result.local_model.real_probability, color: "bg-green-500" }
                    ].map((bar) => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400">{bar.label}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-355">{(bar.val * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`${bar.color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${bar.val * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 mt-5 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex justify-between"><span>{t('upload.model')}:</span><span className="font-mono">{result.local_model.model_name}</span></div>
                    <div className="flex justify-between"><span>{t('upload.latency')}:</span><span>{result.local_model.processing_time_ms} ms</span></div>
                  </div>
                </div>

                {/* 3. Gemini Analysis Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{t('upload.geminiOpinion')}</h3>
                    {result.gemini_analysis && !result.gemini_analysis.error ? (
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md uppercase
                        ${result.gemini_analysis.predicted_label === "FAKE" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                          result.gemini_analysis.predicted_label === "REAL" ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
                          "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"}`}
                      >
                        {result.gemini_analysis.predicted_label}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        OFF/ERR
                      </span>
                    )}
                  </div>

                  {result.gemini_analysis && !result.gemini_analysis.error ? (
                    <div className="flex flex-col flex-grow">
                      <div className="text-center mb-4">
                        <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">{t('upload.confidenceLevel')}</span>
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                          {result.gemini_analysis.confidence_level} 
                          {result.gemini_analysis.confidence_score > 0 && ` (${(result.gemini_analysis.confidence_score * 100).toFixed(0)}%)`}
                        </span>
                      </div>

                      <div className="space-y-4 flex-grow">
                        <div>
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-550 block mb-1">{t('upload.reasoning')}</span>
                          <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                            {result.gemini_analysis.reasoning_summary}
                          </p>
                        </div>

                        {/* Evidence for FAKE */}
                        {result.gemini_analysis.evidence_for_fake && result.gemini_analysis.evidence_for_fake.length > 0 && (
                          <div>
                            <span className="text-xs font-bold text-red-500 block mb-1">{t('upload.evidenceFake')}:</span>
                            <ul className="space-y-1 text-[11px] text-slate-550 dark:text-slate-400">
                              {result.gemini_analysis.evidence_for_fake.map((sig, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-red-500 mt-0.5">❌</span>
                                  <span className="leading-tight">{sig}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Evidence for REAL */}
                        {result.gemini_analysis.evidence_for_real && result.gemini_analysis.evidence_for_real.length > 0 && (
                          <div>
                            <span className="text-xs font-bold text-green-500 block mb-1">{t('upload.evidenceReal')}:</span>
                            <ul className="space-y-1 text-[11px] text-slate-550 dark:text-slate-400">
                              {result.gemini_analysis.evidence_for_real.map((sig, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-green-500 mt-0.5">✓</span>
                                  <span className="leading-tight">{sig}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Uncertainty Reasons */}
                        {result.gemini_analysis.uncertainty_reasons && result.gemini_analysis.uncertainty_reasons.length > 0 && (
                          <div>
                            <span className="text-xs font-bold text-amber-500 block mb-1">{t('upload.uncertainty')}:</span>
                            <ul className="space-y-1 text-[11px] text-slate-550 dark:text-slate-400">
                              {result.gemini_analysis.uncertainty_reasons.map((sig, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-amber-500 mt-0.5">⚠</span>
                                  <span className="leading-tight">{sig}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {result.gemini_analysis.recommendation && (
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-450 dark:text-slate-500 leading-snug">
                          <strong>{t('upload.geminiRecommendation')}:</strong> {result.gemini_analysis.recommendation}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col justify-center items-center text-center p-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed">
                        {result.gemini_analysis?.reasoning_summary || t('upload.geminiUnavailable')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Save info footer */}
              {result.image_url && (
                <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 px-2">
                  <a href={result.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {t('upload.viewCloudinary')}
                  </a>
                  {result.cloudinary_warning && (
                    <span className="text-amber-500">⚠ {result.cloudinary_warning}</span>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* Empty state mockup */
            <div className="bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800 min-h-[440px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-8 text-center select-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-4 opacity-30 text-indigo-500 dark:text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-350 mb-1">{t('upload.awaitTitle')}</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                {t('upload.awaitDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AuthGuard>
      <UploadContent />
    </AuthGuard>
  );
}
