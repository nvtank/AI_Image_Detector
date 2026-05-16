"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type HistoryLog = {
  id: number;
  source_type: string;
  image_name: string | null;
  image_url: string | null;
  label: string;
  confidence: number;
  model_name: string;
  processing_time_ms: number;
  created_at: string;
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory();
        setLogs(data);
      } catch (err: any) {
        setError(err.message || "Failed to load prediction history");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    // SQLite CURRENT_TIMESTAMP is UTC format: YYYY-MM-DD HH:MM:SS
    // Add T and Z to properly parse as UTC in JS
    const safeDateString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(safeDateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  const getSourceDisplay = (log: HistoryLog) => {
    if (log.source_type === "url") {
      return (
        <div className="flex items-center gap-2 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <a href={log.image_url!} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px] inline-block" title={log.image_url!}>
            {log.image_url}
          </a>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <span className="truncate max-w-[200px] inline-block" title={log.image_name!}>
          {log.image_name}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 font-medium">Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4 bg-red-50 text-red-600 rounded-lg mt-8 border border-red-200">
        <h3 className="font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Error
        </h3>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Prediction History</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Recent image checks processed by the AI models.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-slate-600 dark:text-slate-300">
          Total Logs: <span className="font-bold text-blue-600 dark:text-blue-400">{logs.length}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">No history yet</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              You haven't analyzed any images yet. Upload an image to start generating prediction logs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Time</th>
                  <th className="px-6 py-4 font-semibold">Source</th>
                  <th className="px-6 py-4 font-semibold">Result</th>
                  <th className="px-6 py-4 font-semibold">Confidence</th>
                  <th className="px-6 py-4 font-semibold">Model</th>
                  <th className="px-6 py-4 font-semibold text-right">Time (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {getSourceDisplay(log)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                        log.label === 'FAKE' 
                          ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800/50' 
                          : 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800/50'
                      }`}>
                        {log.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">
                      {(log.confidence * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {log.model_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-right">
                      {log.processing_time_ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
