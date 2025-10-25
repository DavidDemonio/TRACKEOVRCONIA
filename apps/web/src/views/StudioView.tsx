import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTracking } from '../hooks/useTracking';
import { useAppStore } from '../state/store';
import { jointNames, type JointName } from '@trackeovrconia/proto';

const skeletonConnections: Array<[JointName, JointName]> = [
  ['hip', 'chest'],
  ['chest', 'head'],
  ['chest', 'shoulder_l'],
  ['shoulder_l', 'elbow_l'],
  ['elbow_l', 'wrist_l'],
  ['chest', 'shoulder_r'],
  ['shoulder_r', 'elbow_r'],
  ['elbow_r', 'wrist_r'],
  ['hip', 'knee_l'],
  ['knee_l', 'ankle_l'],
  ['ankle_l', 'foot_l'],
  ['hip', 'knee_r'],
  ['knee_r', 'ankle_r'],
  ['ankle_r', 'foot_r'],
];

const StudioView = () => {
  const { videoRef, overlayRef, startTracking, stopTracking, trackingActive, trackingError, secureContext } =
    useTracking('/models');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useAppStore((state) => state.lastFrame);
  const pointsRef = useRef<Record<string, THREE.Mesh>>({});
  const lineGeometryRef = useRef<THREE.BufferGeometry>();
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5);
    camera.position.set(0, 0, 2.2);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const resize = () => {
      if (!canvasRef.current) return;
      const { clientWidth, clientHeight } = canvasRef.current;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasRef.current);
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(0.3, 1, 1);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(light);
    const material = new THREE.MeshStandardMaterial({ color: '#38bdf8' });
    const geometry = new THREE.SphereGeometry(0.025, 16, 16);
    jointNames.forEach((joint) => {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.visible = false;
      scene.add(mesh);
      pointsRef.current[joint] = mesh;
    });

    const linePositions = new Float32Array(skeletonConnections.length * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#f472b6' });
    const skeleton = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(skeleton);
    lineGeometryRef.current = lineGeometry;

    const animate = () => {
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lineGeometry.dispose();
      lineMaterial.dispose();
      skeleton.removeFromParent();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      pointsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!frame) return;
    const lineGeometry = lineGeometryRef.current;
    const positions = lineGeometry?.getAttribute('position');
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
    if (positions && positions instanceof THREE.BufferAttribute) {
      skeletonConnections.forEach(([a, b], index) => {
        const start = frame.joints[a]?.pos;
        const end = frame.joints[b]?.pos;
        const vertexIndex = index * 2;
        if (start && end) {
          positions.setXYZ(vertexIndex, (start[0] - 0.5) * 2, (0.5 - start[1]) * 2, -start[2]);
          positions.setXYZ(vertexIndex + 1, (end[0] - 0.5) * 2, (0.5 - end[1]) * 2, -end[2]);
        } else {
          positions.setXYZ(vertexIndex, 0, 0, 0);
          positions.setXYZ(vertexIndex + 1, 0, 0, 0);
        }
      });
      positions.needsUpdate = true;
    }
  }, [frame]);

  const trackingCTA = useMemo(() => (trackingActive ? 'Detener tracking' : 'Iniciar tracking'), [trackingActive]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-xl border border-slate-700">
        <video ref={videoRef} className="h-full w-full bg-black" playsInline muted></video>
        <canvas ref={overlayRef} className="absolute inset-0" width={640} height={480}></canvas>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent"></div>
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={trackingActive ? stopTracking : startTracking}
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow transition focus:outline-none focus-visible:ring ${
              trackingActive
                ? 'bg-rose-500/90 text-white hover:bg-rose-500'
                : 'bg-emerald-500/90 text-white hover:bg-emerald-500'
            }`}
            disabled={!secureContext}
          >
            {trackingCTA}
          </button>
          {!secureContext && (
            <span className="pointer-events-none rounded bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
              Necesitas servir la app sobre HTTPS o localhost para permitir el acceso a la cámara.
            </span>
          )}
          {trackingError && <span className="pointer-events-auto rounded bg-amber-500/20 px-3 py-1 text-xs text-amber-200">{trackingError}</span>}
          {!trackingError && trackingActive && (
            <span className="pointer-events-none rounded bg-emerald-500/20 px-3 py-1 text-xs text-emerald-100">
              Tracking en vivo
            </span>
          )}
        </div>
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
