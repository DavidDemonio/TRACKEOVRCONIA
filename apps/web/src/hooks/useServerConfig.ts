import { useEffect } from 'react';
import { useAppStore } from '../state/store';

export const useServerConfig = () => {
  const setVideoConfig = useAppStore((state) => state.setVideoConfig);
  const setSinks = useAppStore((state) => state.setSinks);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((config) => setVideoConfig(config.video));
    fetch('/api/sinks')
      .then((res) => res.json())
      .then((sinks) => setSinks(sinks));
  }, [setVideoConfig, setSinks]);

  return {
    updateVideoConfig: async (videoConfig: Partial<ReturnType<typeof useAppStore.getState>['videoConfig']>) => {
      const res = await fetch('/api/config/video', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoConfig),
      });
      const data = await res.json();
      setVideoConfig(data);
    },
  };
};
