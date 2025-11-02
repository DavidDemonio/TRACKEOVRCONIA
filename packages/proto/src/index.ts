import { z } from 'zod';

export const jointNames = [
  'hip',
  'chest',
  'head',
  'shoulder_l',
  'elbow_l',
  'wrist_l',
  'shoulder_r',
  'elbow_r',
  'wrist_r',
  'knee_l',
  'ankle_l',
  'foot_l',
  'knee_r',
  'ankle_r',
  'foot_r',
] as const;

export const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const quaternionSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

export const jointSchema = z.object({
  pos: vector3Schema,
  rotQuat: quaternionSchema,
  conf: z.number().min(0).max(1),
});

export const bodyFrameSchema = z.object({
  timestamp: z.number().nonnegative(),
  joints: z.record(z.enum(jointNames), jointSchema.partial({
    pos: true,
    rotQuat: true,
    conf: true,
  })).default({}),
});

export type JointName = (typeof jointNames)[number];
export type Vector3 = z.infer<typeof vector3Schema>;
export type Quaternion = z.infer<typeof quaternionSchema>;
export type Joint = z.infer<typeof jointSchema>;
export type BodyFrame = z.infer<typeof bodyFrameSchema>;

export const trackingMessageSchema = z.object({
  type: z.literal('tracking'),
  payload: bodyFrameSchema,
});

export const monitorMessageSchema = z.object({
  cameraFps: z.number(),
  effectiveFps: z.number(),
  afiMultiplier: z.number().optional(),
  srEnabled: z.boolean().optional(),
  gpuBackend: z.string().optional(),
  addedLatencyMs: z.number().optional(),
});

export const smoothingConfigSchema = z.object({
  filter: z.enum(['one-euro', 'kalman']),
  beta: z.number().optional(),
  minCutoff: z.number().optional(),
  r: z.number().optional(),
  q: z.number().optional(),
});

export const oscSinkSchema = z.object({
  id: z.string(),
  type: z.literal('osc'),
  host: z.string(),
  port: z.number(),
  namespace: z.string().default('/body'),
  flat: z.boolean().default(false),
});

export const slimeVrSinkSchema = z.object({
  id: z.string(),
  type: z.literal('slimevr'),
  host: z.string(),
  port: z.number(),
  profileId: z.string(),
});

export const sinkSchema = z.discriminatedUnion('type', [
  oscSinkSchema,
  slimeVrSinkSchema,
]);

export const serverConfigSchema = z.object({
  smoothing: smoothingConfigSchema,
  sinks: z.array(sinkSchema).default([]),
  video: z.object({
    targetFps: z.number().default(60),
    aiSmooth: z.enum(['auto', 'on', 'off']).default('auto'),
    sr: z.enum(['off', 'auto']).default('off'),
    serverAfiUrl: z.string().optional(),
  }),
  studio: z.object({
    monitorEnabled: z.boolean().default(true),
  }),
});

export type OscSink = z.infer<typeof oscSinkSchema>;
export type SlimeVrSink = z.infer<typeof slimeVrSinkSchema>;
export type Sink = z.infer<typeof sinkSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;

export const defaultConfig: ServerConfig = {
  smoothing: {
    filter: 'one-euro',
    beta: 0.01,
    minCutoff: 1.0,
  },
  sinks: [],
  video: {
    targetFps: 60,
    aiSmooth: 'auto',
    sr: 'off',
  },
  studio: {
    monitorEnabled: true,
  },
};

export const configFileSchema = z.object({
  server: serverConfigSchema,
  slimevr: z.object({
    trackers: z.record(z.string(), z.object({
      joint: z.enum(jointNames),
      offset: vector3Schema.default([0, 0, 0]),
      yaw: z.number().default(0),
      roll: z.number().default(0),
    })),
  }).default({ trackers: {} }),
});

export type ConfigFile = z.infer<typeof configFileSchema>;
