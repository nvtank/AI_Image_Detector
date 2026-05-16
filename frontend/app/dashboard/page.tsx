export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Model Benchmarks</h1>
        <p className="text-slate-500 dark:text-slate-400">Performance metrics of the deep learning models used in this system.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Active Model</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">Loading...</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Clean Accuracy</h3>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Robustness Score</h3>
          <p className="text-2xl font-bold">--</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 min-h-[300px] flex items-center justify-center">
        <p className="text-slate-500">Charts and detailed metrics will be implemented in the next phase.</p>
      </div>
    </div>
  );
}
