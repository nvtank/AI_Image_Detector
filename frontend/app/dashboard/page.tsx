"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
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
  available_models: { name: string; role: string; clean_f1: number; robust_avg_f1: number }[];
};

function Skeleton({ h = 20, r = 8 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: "var(--bg-3)",
      animation: "pulse 1.5s ease infinite",
    }} />
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [metricsData, setMetricsData] = useState<ModelMetrics[]>([]);
  const [modelsInfo, setModelsInfo] = useState<ModelsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getMetrics(), api.getModels()])
      .then(([m, mo]) => { setMetricsData(m.model_comparison || []); setModelsInfo(mo); })
      .catch(e => setError(e.message || t('dashboard.failedLoad')))
      .finally(() => setIsLoading(false));
  }, []);

  const chartData = metricsData.map(m => ({
    name: m.model_name.replace("efficientnetv2_", "").replace("_", " "),
    "Clean F1": +((m.clean_f1 * 100).toFixed(2)),
    "Robust F1": +((m.robust_avg_f1 * 100).toFixed(2)),
  }));

  const activeModel = modelsInfo?.active_model || "";
  const activeData = metricsData.find(m => m.model_name === activeModel);
  const cleanF1 = ((activeData?.clean_f1 || 0) * 100).toFixed(2);
  const robustF1 = ((activeData?.robust_avg_f1 || 0) * 100).toFixed(2);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: "4rem" }} className="fade-up">

      {/* Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-1)" }}>
          {t('dashboard.title')}
        </h1>
        <p style={{ color: "var(--text-3)", marginTop: "0.35rem", fontSize: "0.9375rem" }}>
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Active model banner */}
      {isLoading ? (
        <div className="card" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
          <Skeleton h={16} r={6} />
          <div style={{ height: 8 }} />
          <Skeleton h={36} r={6} />
        </div>
      ) : (
        <div className="card" style={{
          padding: "1.75rem 2rem",
          marginBottom: "1.5rem",
          display: "flex", flexDirection: "row",
          justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "1.25rem",
        }}>
          <div>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-4)", marginBottom: "0.4rem" }}>
              {t('dashboard.activeModel')}
            </p>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>
              {activeModel || "—"}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-4)", marginTop: 4 }}>
              v{modelsInfo?.model_version} · {t('dashboard.production')}
            </p>
          </div>
          <div style={{ display: "flex", gap: "2.5rem" }}>
            {[{ label: t('dashboard.cleanF1'), val: cleanF1 }, { label: t('dashboard.robustF1'), val: robustF1 }].map(({ label, val }) => (
              <div key={label} style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--text-4)", marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-1)" }}>
                  {val}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart + Table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}
           className="max-lg:grid-cols-1">

        {/* Bar chart */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "1.25rem" }}>
            {t('dashboard.chartTitle')}
          </p>
          {isLoading ? <Skeleton h={240} r={6} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: "var(--text-4)", fontSize: 11 }} dy={6} />
                <YAxis domain={[90, 100]} axisLine={false} tickLine={false}
                  tick={{ fill: "var(--text-4)", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "var(--bg-2)" }}
                  contentStyle={{
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: 13, color: "var(--text-1)",
                  }}
                />
                <Bar dataKey="Clean F1" fill="var(--text-3)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Robust F1" fill="var(--text-1)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)" }}>{t('dashboard.tableTitle')}</p>
          </div>
          {isLoading ? (
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} h={18} />)}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {[t('dashboard.colModel'), t('dashboard.colCleanF1'), t('dashboard.colRobustF1'), t('dashboard.colDrop')].map(h => (
                      <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "left", fontWeight: 500, color: "var(--text-4)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricsData.map(row => (
                    <tr key={row.model_name} style={{
                      borderBottom: "1px solid var(--border)",
                      background: row.model_name === activeModel ? "var(--bg-2)" : "transparent",
                    }}>
                      <td style={{ padding: "0.65rem 1rem", color: "var(--text-1)", fontWeight: row.model_name === activeModel ? 600 : 400, display: "flex", alignItems: "center", gap: 6 }}>
                        {row.model_name}
                        {row.model_name === activeModel && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-2)", flexShrink: 0 }} />
                        )}
                      </td>
                      <td style={{ padding: "0.65rem 1rem", color: "var(--text-2)" }}>{(row.clean_f1 * 100).toFixed(2)}%</td>
                      <td style={{ padding: "0.65rem 1rem", color: "var(--text-1)", fontWeight: 600 }}>{(row.robust_avg_f1 * 100).toFixed(2)}%</td>
                      <td style={{ padding: "0.65rem 1rem", color: "var(--text-3)" }}>{(row.avg_drop * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Methodology */}
      <div className="card" style={{ padding: "1.75rem 2rem" }}>
        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "1.5rem" }}>
          {t('dashboard.methTitle')}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}
             className="max-md:grid-cols-1">
          {[
            {
              n: "01", title: t('dashboard.meth1Title'),
              body: t('dashboard.meth1Body')
            },
            {
              n: "02", title: t('dashboard.meth2Title'),
              body: t('dashboard.meth2Body')
            },
            {
              n: "03", title: `${t('dashboard.meth3TitlePrefix')} ${activeModel || 'this model'}?`,
              body: `${t('dashboard.meth3BodyPrefix')} ${cleanF1}% ${t('dashboard.meth3BodySuffix')}`
            },
          ].map(({ n, title, body }) => (
            <div key={n}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-4)", marginBottom: "0.5rem" }}>
                {n}
              </p>
              <h4 style={{ fontWeight: 600, color: "var(--text-1)", marginBottom: "0.5rem", fontSize: "0.9375rem" }}>
                {title}
              </h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
