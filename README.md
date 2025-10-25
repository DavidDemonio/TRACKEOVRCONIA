# Trackeovrconia

Aplicación full-body tracking con MediaPipe, AI Smooth FPS, salida OSC y adaptador SlimeVR. Incluye servidor Node.js (Express + ws), cliente React (Vite + Tailwind), filtros de suavizado One Euro / Kalman y módulo AFI WebGPU.

## Características principales

- **Cliente Web (Vite + React + Tailwind)**
  - Selector de cámara y vista previa con overlay BlazePose.
  - Calibración visual, heatmap y panel de métricas en vivo (FPS, latencia, backend GPU, AI Smooth y SR).
  - Control de suavizado One Euro/Kalman, modo Studio con vista 3D (Three.js) y gestión de endpoints OSC/SlimeVR.
  - AI Smooth FPS con interpolación AFI (RIFE-lite) y super-resolución opcional (ESRGAN-lite). Fallback a WebGL o servidor.
  - Grabación/reproducción (NDJSON) vía API y exportación de pose.

- **Servidor Node.js (TypeScript + Express + ws)**
  - Normaliza frames, aplica filtros (One Euro/Kalman) y re-emite vía OSC (namespace configurable) y adaptador SlimeVR.
  - API REST: configuración, sinks (OSC/SlimeVR), sesiones de grabación, health y configuración de video.
  - WebSocket de tracking (cliente→server) y canal monitor (server→diagnóstico).
  - Logs estructurados (pino), métricas Prometheus (`/metrics`), configuración persistente en `config/config.json`.

- **Paquetes reutilizables** (`packages/`)
  - `@trackeovrconia/proto`: tipos y esquemas Zod (BodyFrame, sinks, config).
  - `@trackeovrconia/utils`: filtros One Euro / Kalman y utilidades de métricas.
  - `@trackeovrconia/video-afi`: wrapper AFI para interpolación WebGPU/WebGL.

- **Extras**
  - `tools/osc-listener.js` para depurar tráfico OSC.
  - Dockerfile multi-stage + `docker-compose.yml`.
  - Tests con Vitest (server, utils, UI) y linting con ESLint.

## Estructura

```
apps/
  server/   # Express + ws + OSC + SlimeVR
  web/      # Vite + React + Tailwind + Three.js
packages/
  proto/    # Zod schemas & tipos compartidos
  utils/    # Filtros One Euro / Kalman + helpers
  video-afi/# Wrapper AFI onnxruntime-web
tools/
  osc-listener.js
```

## Requisitos previos

- Node.js 20+
- pnpm 8+
- GPU compatible WebGL/WebGPU (cliente) para AFI/SR
- Modelos en `apps/web/public/models/`:
  - `pose_landmarker_full.task`
  - `rife-lite.onnx`
  - `esrgan-lite.onnx` (opcional)

## Comandos pnpm

```bash
pnpm install       # instala dependencias
pnpm dev           # levanta server (4000) + web (5173)
pnpm build         # compila server + web
pnpm start         # compila y arranca server (4000) + preview web HTTPS (5173)
pnpm lint          # ESLint en todos los paquetes
pnpm test          # Vitest (packages, server, web)
```

### Desarrollo

- `pnpm --filter server dev` para server en modo watch (tsx).
- `pnpm --filter web dev` para UI (Vite hot reload).

## Docker

Construye la imagen multi-stage:

```bash
docker build -t trackeovrconia .
docker compose up
```

La UI queda disponible en `https://localhost:5173` (certificado auto-firmado), el server REST/WebSocket en `http://localhost:4000`.
Al primer acceso acepta el certificado para que Chrome permita la cámara.

Variables `.env` relevantes (pueden definirse en `docker-compose.yml` o `.env`):

- `PORT` (default 4000)
- `HOST` (bind address)

## API REST

| Método | Ruta                 | Descripción |
|--------|----------------------|-------------|
| GET    | `/api/health`        | Estado del servidor |
| GET    | `/api/config`        | Configuración completa |
| PUT    | `/api/config`        | Actualiza configuración (parcial) |
| GET    | `/api/config/video`  | Configuración video/AI Smooth |
| PUT    | `/api/config/video`  | Actualiza video ({ targetFps, aiSmooth, sr, serverAfiUrl? }) |
| GET    | `/api/sinks`         | Listado de sinks OSC/SlimeVR |
| POST   | `/api/sinks`         | Añade sink (OSC o SlimeVR) |
| DELETE | `/api/sinks/:id`     | Elimina sink |
| POST   | `/api/sessions`      | `{ action: 'start' | 'stop' }` grabación NDJSON |

## WebSocket

- `/ws` (tracking): el cliente envía `{ type: 'tracking', payload: BodyFrame, metrics, smoothing }`.
- `/ws?mode=monitor`: receptores de monitor reciben `{ type: 'monitor', frame, metrics }`.

## OSC & SlimeVR

- OSC UDP namespace: `/body/<joint>/{pos|rotQuat|conf}`
- SlimeVR adapter: envía paquetes JSON `{ trackers: [...] }` vía UDP al servidor SlimeVR (configurable host/puerto/perfil).

## Grabación y replay

- `POST /api/sessions { action: 'start' }` crea archivo `sessions/<uuid>.ndjson`.
- `POST /api/sessions { action: 'stop' }` finaliza.

## Tests

- `pnpm --filter @trackeovrconia/utils test` (filtros + métricas)
- `pnpm --filter server test`
- `pnpm --filter web test`

## Troubleshooting

- Si no hay GPU WebGPU, el cliente cae a WebGL o modo directo sin AFI.
- Chrome/Edge requieren contexto seguro (HTTPS o localhost) para exponer cámaras. Usa `pnpm start` (serve HTTPS) o un proxy TLS propio.
- Coloca los modelos ONNX en `apps/web/public/models/` antes de construir.
- Usa `tools/osc-listener.js 9000` para verificar salida OSC.
- Configuración persistente en `config/config.json` (se crea automáticamente).

## Licencia

[MIT](LICENSE)
