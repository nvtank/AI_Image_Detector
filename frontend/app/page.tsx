import Link from "next/link";

export default function Home() {
  const stats = [
    { label: "Clean F1 Score", value: "98.6%" },
    { label: "Robust F1 Score", value: "98.1%" },
    { label: "Models Compared", value: "4" },
    { label: "Avg Inference Time", value: "<200ms" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center">
      <div className="mb-6 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full text-sm font-semibold">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        Powered by EfficientNetV2 · PyTorch · FastAPI
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 pb-2">
        AI Image Detector
      </h1>
      <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-2xl mb-12">
        Detect AI-generated images with state-of-the-art Deep Learning. Upload a photo or right-click any image on the web.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-16">
        <Link
          href="/upload"
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 text-lg"
        >
          Try It Now →
        </Link>
        <Link
          href="/dashboard"
          className="px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold rounded-full transition-all shadow-sm text-lg"
        >
          View Benchmarks
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-3xl">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stat.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
