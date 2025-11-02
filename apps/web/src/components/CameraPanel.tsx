import { useCameraDevices } from '../hooks/useCameraDevices';
import { useAppStore } from '../state/store';

const CameraPanel = () => {
  const { devices, error } = useCameraDevices();
  const selected = useAppStore((state) => state.selectedCamera);
  const selectCamera = useAppStore((state) => state.selectCamera);

  return (
    <section className="rounded-lg bg-slate-800 p-4 shadow">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cámara</h2>
        <span className="text-xs text-slate-400">Selección de dispositivo</span>
      </header>
      {error && <p className="text-sm text-amber-400">{error}</p>}
      <select
        className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm"
        value={selected}
        onChange={(event) => selectCamera(event.target.value)}
      >
        <option value="">Predeterminada</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <p className="mt-3 text-xs text-slate-400">
        Otorga permisos de cámara para acceder a todos los dispositivos disponibles.
      </p>
    </section>
  );
};

export default CameraPanel;
