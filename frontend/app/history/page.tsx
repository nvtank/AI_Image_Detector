"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api";

type HistoryItem = {
  id: number;
  source_type: string;
  image_name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  label: string; // final decision is stored in standard label column
  confidence: number;
  fake_probability: number;
  real_probability: number;
  model_name: string;
  processing_time_ms: number;
  created_at: string;
  
  // Hybrid fields
  local_predicted_label?: string | null;
  local_confidence?: number | null;
  gemini_predicted_label?: string | null;
  gemini_confidence_level?: string | null;
  gemini_reasoning_summary?: string | null;
  gemini_visual_signals?: string[] | null;
  gemini_limitations?: string | null;
  agreement_status?: string | null;
  final_decision?: string | null;
  used_gemini?: boolean | null;
};

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f1f5f9'/%3E%3Ctext x='150' y='155' text-anchor='middle' font-size='14' fill='%2394a3b8'%3ENo Image%3C/text%3E%3C/svg%3E";

function HistoryContent() {
  const [logs, setLogs] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHistory();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateStr: string) => {
    const safe = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z";
    return new Intl.DateTimeFormat("en-US", { 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    }).format(new Date(safe));
  };

  // Perform instant client-side filtering
  const filteredLogs = logs.filter((log) => {
    const finalDecision = log.final_decision || log.label;
    if (filter === "ALL") return true;
    if (filter === "FAKE") return finalDecision === "FAKE";
    if (filter === "REAL") return finalDecision === "REAL";
    if (filter === "UNCERTAIN") return finalDecision === "UNCERTAIN";
    if (filter === "AGREE") return log.agreement_status === "agree";
    if (filter === "DISAGREE") return log.agreement_status === "disagree";
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto pb-16 px-4">
      {/* History Header */}
      <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
            Analysis History
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Browse and inspect all past images analyzed by our local model and Gemini hybrid reviewer.
          </p>
        </div>

        {/* Filters Grid */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl max-w-full overflow-x-auto select-none">
          {[
            { id: "ALL", label: "All" },
            { id: "FAKE", label: "Fake" },
            { id: "REAL", label: "Real" },
            { id: "UNCERTAIN", label: "Uncertain" },
            { id: "AGREE", label: "Agree" },
            { id: "DISAGREE", label: "Disagree" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                filter === tab.id
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white scale-[1.02]"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center min-h-[40vh]">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-xl text-sm leading-relaxed mb-6">
          {error}
        </div>
      )}

      {!isLoading && !error && filteredLogs.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-400 dark:text-slate-650 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-10 border border-slate-200/50 dark:border-slate-850 select-none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-4 opacity-30 text-indigo-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h3 className="text-xl font-semibold mb-1 text-slate-600 dark:text-slate-400">No matching logs</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500">No history entries fit the selected criteria.</p>
        </div>
      )}

      {/* History Grid */}
      {!isLoading && !error && filteredLogs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredLogs.map((log) => {
            const finalDecision = log.final_decision || log.label;
            return (
              <div
                key={log.id}
                onClick={() => setSelectedItem(log)}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col cursor-pointer transition-all duration-300 transform hover:scale-[1.015]"
              >
                {/* Thumbnail Layer */}
                <div className="relative aspect-square bg-slate-50 dark:bg-slate-950/40">
                  <Image
                    src={log.thumbnail_url || log.image_url || PLACEHOLDER}
                    alt={log.image_name || "Analyzed image"}
                    fill
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                    unoptimized
                  />
                  
                  {/* Final Label Overlay */}
                  <span className={`absolute top-3 right-3 px-2.5 py-0.5 text-xs font-bold rounded-full shadow-sm ${
                    finalDecision === "FAKE" ? "bg-red-500 text-white" :
                    finalDecision === "REAL" ? "bg-green-500 text-white" :
                    "bg-amber-500 text-white"
                  }`}>
                    {finalDecision}
                  </span>

                  {/* Sources Overlay */}
                  {log.source_type === "screenshot" && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-600 text-white shadow-sm flex items-center gap-1">
                      📸 Screenshot
                    </span>
                  )}
                  {log.source_type === "url" && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-600 text-white shadow-sm flex items-center gap-1">
                      🔗 URL
                    </span>
                  )}

                  {/* Agreement Overlay Footer */}
                  {log.used_gemini && (
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-1 select-none">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded shadow-sm text-white
                        ${log.agreement_status === "agree" ? "bg-green-600/90" : "bg-red-600/90"}`}
                      >
                        {log.agreement_status === "agree" ? "✨ Agreed" : "⚠ Disagreed"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col gap-2.5 flex-grow">
                  <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-100" title={log.image_name || log.image_url || "image"}>
                    {log.image_name || (log.source_type === "screenshot" ? "Captured screen selection" : "Untitled analysis")}
                  </p>

                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Inference latency</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-350">{log.processing_time_ms} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confidence</span>
                      <span className="font-bold text-slate-700 dark:text-slate-350">{(log.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date analyzed</span>
                      <span className="text-slate-400 dark:text-slate-500">{formatDate(log.created_at)}</span>
                    </div>
                  </div>

                  <span className="text-[10px] text-indigo-500 font-semibold mt-auto pt-2 block text-center uppercase tracking-wider group-hover:underline">
                    Inspect Report →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. PREMIUM REPORT MODAL VIEW */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 flex flex-col animate-in scale-in duration-300">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-150 dark:border-slate-850 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate max-w-md">
                  Report #{selectedItem.id}: {selectedItem.image_name || "Screen Capture"}
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  Analyzed at {formatDate(selectedItem.created_at)}
                </span>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left col: Image Preview (5 cols) */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-950">
                    <Image
                      src={selectedItem.image_url || PLACEHOLDER}
                      alt={selectedItem.image_name || "Full View"}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  {selectedItem.image_url && (
                    <a
                      href={selectedItem.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-center text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors flex justify-center items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open Full Resolution
                    </a>
                  )}
                </div>

                {/* Right col: Stats & Details (7 cols) */}
                <div className="md:col-span-7 space-y-5">
                         {/* Decision Display */}
                  <div className={`p-5 rounded-2xl border ${
                    (selectedItem.final_decision || selectedItem.label) === "FAKE" ? "bg-red-50/55 dark:bg-red-950/10 border-red-100 dark:border-red-900/20" :
                    (selectedItem.final_decision || selectedItem.label) === "REAL" ? "bg-green-50/55 dark:bg-green-950/10 border-green-100 dark:border-green-900/20" :
                    "bg-amber-50/55 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20"
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">Final Combined Verdict</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-3xl font-black ${
                        (selectedItem.final_decision || selectedItem.label) === "FAKE" ? "text-red-600 dark:text-red-500" :
                        (selectedItem.final_decision || selectedItem.label) === "REAL" ? "text-green-600 dark:text-green-500" :
                        "text-amber-500 dark:text-amber-400"
                      }`}>
                        {selectedItem.final_decision || selectedItem.label}
                      </span>
                      
                      {selectedItem.used_gemini && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm
                          ${selectedItem.agreement_status === "agree" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" :
                            "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"}`}
                        >
                          {selectedItem.agreement_status === "agree" ? "✓ Systems Agree" : "⚠ Systems Disagree"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recommendation Callout */}
                  {selectedItem.used_gemini && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850">
                      <strong className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Expert Recommendation:</strong>
                      <p className="text-xs text-slate-600 dark:text-slate-450 leading-relaxed italic">
                        "{selectedItem.gemini_limitations || "Không có khuyến nghị cụ thể."}"
                      </p>
                    </div>
                  )}

                  {/* Two Column Grid: Local Model vs Gemini */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Local Model stats */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-450 block mb-2 uppercase tracking-wide">
                        Local Deep Model
                      </span>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Result:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {selectedItem.local_predicted_label || selectedItem.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Confidence:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {((selectedItem.local_confidence || selectedItem.confidence) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Latency:</span>
                          <span className="text-slate-500">{selectedItem.processing_time_ms} ms</span>
                        </div>
                      </div>
                    </div>

                    {/* Gemini Opinion */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                      <span className="text-[10px] font-bold text-slate-450 block mb-2 uppercase tracking-wide">
                        Gemini Reviewer
                      </span>
                      {selectedItem.used_gemini ? (
                        <div className="space-y-1.5 text-xs flex-grow">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Opinion:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {selectedItem.gemini_predicted_label || "UNCERTAIN"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Confidence:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                              {selectedItem.gemini_confidence_level || "low"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 flex items-center justify-center h-full">
                          Bypassed / Off
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Gemini Reasoning & Visual signals expanded section */}
              {selectedItem.used_gemini && (
                <div className="p-5 bg-slate-50/40 dark:bg-slate-950/10 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
                      Gemini Visual Reasoning
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedItem.gemini_reasoning_summary || "Không có giải trình chi tiết."}
                    </p>
                  </div>

                  {selectedItem.gemini_visual_signals && selectedItem.gemini_visual_signals.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                        Visual Signals Detected
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-450">
                        {selectedItem.gemini_visual_signals.map((sig, i) => (
                          <li key={i} className="flex items-start gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{sig}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedItem.gemini_limitations && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-550 border-t border-slate-200/50 dark:border-slate-850/50 pt-3">
                      <strong>Limitations of this assessment:</strong> {selectedItem.gemini_limitations}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 dark:border-slate-850 flex justify-end bg-slate-50 dark:bg-slate-900 sticky bottom-0">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-sm"
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
