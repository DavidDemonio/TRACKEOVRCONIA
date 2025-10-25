import { useServerConfig } from '../hooks/useServerConfig';
import { useAppStore } from '../state/store';

const AISmoothPanel = () => {
  const videoConfig = useAppStore((state) => state.videoConfig);
  const { updateVideoConfig } = useServerConfig();

  return (
    <section className="rounded-lg bg-slate-800 p-4 shadow">
      <header className="mb-3">
        <h2 className="text-lg font-semibold">AI Smooth FPS + Super-Resolution</h2>
      </header>
      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between">
          <span>Modo AI Smooth</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 p-2"
            value={videoConfig.aiSmooth}
            onChange={(event) => updateVideoConfig({ aiSmooth: event.target.value as typeof videoConfig.aiSmooth })}
          >
            <option value="auto">Auto</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="flex items-center justify-between">
          <span>FPS objetivo</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 p-2"
            value={videoConfig.targetFps}
            onChange={(event) => updateVideoConfig({ targetFps: Number(event.target.value) })}
          >
            {[30, 45, 60].map((fps) => (
              <option key={fps} value={fps}>
                {fps}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between">
          <span>Super-Resolution</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 p-2"
            value={videoConfig.sr}
            onChange={(event) => updateVideoConfig({ sr: event.target.value as typeof videoConfig.sr })}
          >
            <option value="off">Off</option>
            <option value="auto">Auto x2</option>
          </select>
        </label>
        <p className="text-xs text-slate-400">
          Activa automáticamente la interpolación de frames cuando la cámara baja de 60 FPS.
        </p>
      </div>
    </section>
  );
};

export default AISmoothPanel;
