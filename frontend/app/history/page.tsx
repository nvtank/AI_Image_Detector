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
  label: string;
  confidence: number;
  fake_probability: number;
  real_probability: number;
  model_name: string;
  processing_time_ms: number;
  created_at: string;
};

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f1f5f9'/%3E%3Ctext x='150' y='155' text-anchor='middle' font-size='14' fill='%2394a3b8'%3ENo Image%3C/text%3E%3C/svg%3E";

function HistoryContent() {
  const [logs, setLogs] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (label?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getHistory({ label: label === "ALL" ? undefined : label });
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(filter);
  }, [filter]);

  const formatDate = (dateStr: string) => {
    const safe = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(safe));
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">My History</h1>
          <p className="text-slate-500 dark:text-slate-400">Images you've analyzed with AI detection.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {["ALL", "FAKE", "REAL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              {f}
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
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800/30 rounded-xl text-sm">{error}</div>
      )}

      {!isLoading && !error && logs.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-4 opacity-50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h3 className="text-xl font-semibold mb-1">No history yet</h3>
          <p className="text-sm">You haven't analyzed any images. Go to Upload to get started!</p>
        </div>
      )}

      {!isLoading && !error && logs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {logs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              {/* Thumbnail */}
              <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                <Image
                  src={log.thumbnail_url || log.image_url || PLACEHOLDER}
                  alt={log.image_name || "Analyzed image"}
                  fill
                  className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                  unoptimized
                />
                {/* FAKE/REAL badge overlay */}
                <span className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-bold rounded-full shadow ${
                  log.label === "FAKE"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                }`}>
                  {log.label}
                </span>
              </div>

              {/* Card body */}
              <div className="p-4 flex flex-col gap-2 flex-grow">
                <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200" title={log.image_name || log.image_url || "URL image"}>
                  {log.image_name || (log.source_type === "url" ? "URL image" : "Untitled")}
                </p>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>Confidence</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{(log.confidence * 100).toFixed(1)}%</span>
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>Time</span>
                  <span>{log.processing_time_ms} ms</span>
                </div>

                <div className="flex justify-between text-xs text-slate-500">
                  <span>Date</span>
                  <span>{formatDate(log.created_at)}</span>
                </div>

                {log.image_url && (
                  <a
                    href={log.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto pt-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View image
                  </a>
                )}
              </div>
            </div>
          ))}
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
