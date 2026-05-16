"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ModelMetrics = {
  model_name: string;
  clean_accuracy: number;
  clean_f1: number;
  robust_avg_f1: number;
  avg_drop: number;
};

type ModelsInfo = {
  active_model: string;
  model_version: string;
  available_models: {
    name: string;
    role: string;
    clean_f1: number;
    robust_avg_f1: number;
  }[];
};

export default function DashboardPage() {
  const [metricsData, setMetricsData] = useState<ModelMetrics[]>([]);
  const [modelsInfo, setModelsInfo] = useState<ModelsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, modelsRes] = await Promise.all([
          api.getMetrics(),
          api.getModels()
        ]);
        
        setMetricsData(metricsRes.model_comparison || []);
        setModelsInfo(modelsRes);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 font-medium">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg max-w-4xl mx-auto mt-8">
        <h3 className="font-bold">Error loading dashboard</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = metricsData.map((m) => ({
    name: m.model_name,
    "Clean F1": Number((m.clean_f1 * 100).toFixed(2)),
    "Robust F1": Number((m.robust_avg_f1 * 100).toFixed(2)),
    "Avg Drop": Number((m.avg_drop * 100).toFixed(2)),
  }));

  const activeModel = modelsInfo?.active_model || "Unknown";
  const activeModelData = metricsData.find(m => m.model_name === activeModel);
  const activeCleanF1 = ((activeModelData?.clean_f1 || 0) * 100).toFixed(2);
  const activeRobustF1 = ((activeModelData?.robust_avg_f1 || 0) * 100).toFixed(2);

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Model Benchmarks</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Performance evaluation of Deep Learning models on real vs AI-generated image datasets.
        </p>
      </div>

      {/* Active Model Highlight */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 rounded-3xl shadow-lg mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-blue-500/50">
        <div>
          <span className="bg-white/20 px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full mb-4 inline-block">Active Champion Model</span>
          <h2 className="text-3xl md:text-4xl font-bold">{activeModel}</h2>
          <p className="text-blue-100 mt-2 opacity-90">Currently serving predictions in production (v{modelsInfo?.model_version})</p>
        </div>
        <div className="flex gap-8 bg-black/10 p-5 rounded-2xl backdrop-blur-sm">
          <div className="text-center">
            <p className="text-blue-100 text-sm font-medium mb-1">Clean F1 Score</p>
            <p className="text-3xl font-bold">{activeCleanF1}%</p>
          </div>
          <div className="text-center">
            <p className="text-blue-100 text-sm font-medium mb-1">Robust F1 Score</p>
            <p className="text-3xl font-bold">{activeRobustF1}%</p>
          </div>
        </div>
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        
        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold">Model Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Model</th>
                  <th className="px-6 py-4 font-semibold">Clean Acc</th>
                  <th className="px-6 py-4 font-semibold">Clean F1</th>
                  <th className="px-6 py-4 font-semibold">Robust F1</th>
                  <th className="px-6 py-4 font-semibold text-red-500">Avg Drop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metricsData.map((row) => (
                  <tr 
                    key={row.model_name} 
                    className={row.model_name === activeModel ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"}
                  >
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      {row.model_name}
                      {row.model_name === activeModel && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" title="Active Model"></span>
                      )}
                    </td>
                    <td className="px-6 py-4">{(row.clean_accuracy * 100).toFixed(2)}%</td>
                    <td className="px-6 py-4">{(row.clean_f1 * 100).toFixed(2)}%</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{(row.robust_avg_f1 * 100).toFixed(2)}%</td>
                    <td className="px-6 py-4 text-red-500 dark:text-red-400">{(row.avg_drop * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold mb-6">Clean F1 vs Robust F1</h3>
          <div className="flex-grow w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis domain={[90, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'rgba(0, 0, 0, 0.05)'}} 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="Clean F1" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="Robust F1" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Educational Context */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <h3 className="text-2xl font-bold mb-8">Evaluation Methodology</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold text-lg mb-3 text-slate-800 dark:text-slate-200 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span>
              Why not just Clean Accuracy?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              In a controlled lab setting ("clean" data), many modern architectures can achieve near-perfect accuracy (99%+). However, real-world images from the internet are often compressed (JPEG), resized, blurry, or noisy. A model relying solely on clean accuracy might overfit to lab conditions and fail drastically in the wild.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-3 text-slate-800 dark:text-slate-200 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">2</span>
              What is Robustness Testing?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              We apply synthetic corruptions (Gaussian Noise, Motion Blur, JPEG Compression, Brightness changes) to our test set. We then measure the model's F1 score across these distorted versions. The "Avg Drop" indicates how fragile the model is when faced with imperfect images.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-lg mb-3 text-slate-800 dark:text-slate-200 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">3</span>
              Selecting the Champion Model
            </h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              We selected <strong>{activeModel}</strong> as the champion not just because of its high Clean F1 score, but because it exhibited the lowest performance drop across all robustness tests (Highest Robust Avg F1). It balances inference speed with exceptional stability against adversarial real-world conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
