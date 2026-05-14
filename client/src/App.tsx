import { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<string>('loading...');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/health`)
      .then((r) => r.json())
      .then((d) => setHealth(JSON.stringify(d)))
      .catch((e) => setHealth(`error: ${e.message}`));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="p-8 rounded-lg bg-slate-800">
        <h1 className="text-2xl font-bold mb-4">CF Tracker</h1>
        <p className="text-sm text-slate-400">Backend says:</p>
        <pre className="mt-2 text-green-400">{health}</pre>
      </div>
    </div>
  );
}

export default App;