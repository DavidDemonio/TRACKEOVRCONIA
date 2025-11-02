import { useEffect, useState } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export const useCameraDevices = () => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const enumerate = async () => {
      if (typeof window !== 'undefined') {
        const isSecure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (!isSecure) {
          setError('La enumeración de cámaras requiere ejecutar la app bajo HTTPS o localhost.');
          setDevices([]);
          return;
        }
      }
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDevices([]);
        return;
      }
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const video = mediaDevices
          .filter((device) => device.kind === 'videoinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Cámara ${index + 1}`,
          }));
        setDevices(video);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    enumerate();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', enumerate);
      return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    }
  }, []);

  return { devices, error };
};
