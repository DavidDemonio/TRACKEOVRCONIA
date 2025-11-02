# Descarga manual de modelos y assets

Este repositorio no almacena archivos binarios. Para ejecutar el cliente con modelos locales de MediaPipe y los modelos ONNX de AI Smooth, descarga manualmente los ficheros listados a continuación y colócalos en la carpeta `apps/web/public/models/`.

> **Consejo:** la carpeta `apps/web/public/models/` está en `.gitignore`, por lo que puedes mantener los binarios localmente sin que se añadan al control de versiones.

## Archivos requeridos

| Archivo destino (`apps/web/public/models/…`) | URL oficial | Notas |
| --- | --- | --- |
| `vision_wasm_internal.js` | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.7/wasm/vision_wasm_internal.js | Código puente WebAssembly de MediaPipe. |
| `vision_wasm_internal.wasm` | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.7/wasm/vision_wasm_internal.wasm | Binario WebAssembly optimizado con SIMD. |
| `vision_wasm_nosimd_internal.js` | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.7/wasm/vision_wasm_nosimd_internal.js | Versión de compatibilidad sin SIMD. |
| `vision_wasm_nosimd_internal.wasm` | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.7/wasm/vision_wasm_nosimd_internal.wasm | Binario WebAssembly sin extensiones SIMD. |
| `pose_landmarker_full.task` | https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task | Modelo BlazePose utilizado por MediaPipe Pose. |
| `rife-lite.onnx` | https://github.com/PINTO0309/PINTO_model_zoo/raw/main/109_RIFE/01_float32/rife.onnx | Renombra el archivo descargado a `rife-lite.onnx` para habilitar la interpolación AFI. |
| `esrgan-lite.onnx` *(opcional)* | https://github.com/microsoft/onnxruntime-inference-examples/raw/main/js/super-resolution/model.onnx | Renombra el archivo descargado a `esrgan-lite.onnx`. Activa la super-resolución cuando esté disponible. |

## Verificación opcional

Puedes verificar la integridad de los archivos descargados comparando el hash SHA-256:

| Archivo | SHA-256 esperado |
| --- | --- |
| `pose_landmarker_full.task` | `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad` |
| `rife-lite.onnx` | `69b06c535eab45004243e9897d985b88e8deef06b9e211cd53a31318b040f468` |
| `esrgan-lite.onnx` | `cbcf9a0bb63e1c3ce5df8bdc9ea903e70ee9dc4c328e676b4906d09ad1b47836` |

Ejemplo de verificación en Linux/macOS:

```bash
cd apps/web/public/models
sha256sum pose_landmarker_full.task
```

## Limpieza antes de publicar

Si necesitas eliminar los binarios del entorno de trabajo (por ejemplo, antes de un commit), basta con borrar los archivos descargados:

```bash
rm apps/web/public/models/*.onnx apps/web/public/models/*.task apps/web/public/models/vision_wasm_*
```

Deja los archivos de texto (`.gitignore`, `README.md`) para mantener la estructura de la carpeta.
