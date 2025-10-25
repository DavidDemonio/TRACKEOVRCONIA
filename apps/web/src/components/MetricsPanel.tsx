import { useAppStore } from '../state/store';

const MetricRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="flex justify-between text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="font-mono text-slate-100">{value ?? '—'}</span>
  </div>
);

const MetricsPanel = () => {
  const metrics = useAppStore((state) => state.metrics);

  return (
    <section className="rounded-lg bg-slate-800 p-4 shadow">
      <header className="mb-3">
        <h2 className="text-lg font-semibold">Diagnóstico en tiempo real</h2>
      </header>
      <div className="space-y-2">
        <MetricRow label="Cam FPS" value={metrics?.cameraFps?.toFixed(1)} />
        <MetricRow label="FPS efectivo" value={metrics?.effectiveFps?.toFixed(1)} />
        <MetricRow label="AFI x" value={metrics?.afiMultiplier} />
        <MetricRow label="SR" value={metrics?.srEnabled ? 'On' : 'Off'} />
        <MetricRow label="Backend GPU" value={metrics?.gpuBackend} />
        <MetricRow label="Latencia añadida" value={metrics?.addedLatencyMs?.toFixed(1)} />
      </div>
    </section>
  );
};

export default MetricsPanel;
