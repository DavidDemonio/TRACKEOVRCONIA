import AISmoothPanel from '../components/AISmoothPanel';
import CameraPanel from '../components/CameraPanel';
import MetricsPanel from '../components/MetricsPanel';
import SinksManager from '../components/SinksManager';
import SmoothingPanel from '../components/SmoothingPanel';
import StudioView from './StudioView';

const App = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">Trackeovrconia Studio</h1>
            <p className="text-sm text-slate-400">
              Tracking full-body con MediaPipe, AI Smooth FPS y salida OSC/SlimeVR
            </p>
          </div>
          <div className="flex gap-2 text-xs text-slate-400">
            <span>GPU Ready</span>
            <span>WebGL/WebGPU</span>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        <StudioView />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CameraPanel />
          <AISmoothPanel />
          <MetricsPanel />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <SmoothingPanel />
          <SinksManager />
        </div>
      </main>
    </div>
  );
};

export default App;
