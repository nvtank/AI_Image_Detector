import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
        AI Image Detector
      </h1>
      <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mb-12">
        A state-of-the-art Deep Learning system to differentiate between real and AI-generated images with high accuracy.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link 
          href="/upload" 
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 text-lg"
        >
          Try Now
        </Link>
        <Link 
          href="/dashboard" 
          className="px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold rounded-full transition-all shadow-sm text-lg"
        >
          View Benchmarks
        </Link>
      </div>
    </div>
  );
}
