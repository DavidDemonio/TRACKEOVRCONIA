import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTracking } from '../hooks/useTracking';
import { useAppStore } from '../state/store';
import { jointNames } from '@trackeovrconia/proto';

const StudioView = () => {
  const { videoRef, overlayRef } = useTracking('/models');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useAppStore((state) => state.lastFrame);
  const pointsRef = useRef<Record<string, THREE.Mesh>>({});

  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 2;
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientWidth);
    const light = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(light);
    const material = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    const geometry = new THREE.SphereGeometry(0.02, 12, 12);
    jointNames.forEach((joint) => {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.visible = false;
      scene.add(mesh);
      pointsRef.current[joint] = mesh;
    });
    const animate = () => {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  useEffect(() => {
    if (!frame) return;
    jointNames.forEach((joint) => {
      const data = frame.joints[joint];
      const mesh = pointsRef.current[joint];
      if (!mesh) return;
      if (!data) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const [x, y, z] = data.pos ?? [0, 0, 0];
      mesh.position.set((x - 0.5) * 2, (0.5 - y) * 2, -z);
    });
  }, [frame]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-xl border border-slate-700">
        <video ref={videoRef} className="h-full w-full bg-black" playsInline muted></video>
        <canvas ref={overlayRef} className="absolute inset-0" width={640} height={480}></canvas>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Vista 3D</h3>
          <span className="text-xs text-slate-400">Modo Studio</span>
        </header>
        <canvas ref={canvasRef} className="h-64 w-full"></canvas>
      </div>
    </div>
  );
};

export default StudioView;
