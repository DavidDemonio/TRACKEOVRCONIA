import { useAppStore } from '../state/store';

const SmoothingPanel = () => {
  const smoothing = useAppStore((state) => state.smoothingStrength);
  const setSmoothing = useAppStore((state) => state.setSmoothing);

  return (
    <section className="rounded-lg bg-slate-800 p-4 shadow">
      <header className="mb-3">
        <h2 className="text-lg font-semibold">Suavizado</h2>
      </header>
      <label className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={smoothing}
          onChange={(event) => setSmoothing(Number(event.target.value))}
          className="flex-1"
        />
        <span className="w-16 text-right font-mono text-sm">{smoothing.toFixed(2)}</span>
      </label>
      <p className="mt-2 text-xs text-slate-400">
        Ajusta la intensidad del filtro One Euro/Kalman según la estabilidad requerida.
      </p>
    </section>
  );
};

export default SmoothingPanel;
