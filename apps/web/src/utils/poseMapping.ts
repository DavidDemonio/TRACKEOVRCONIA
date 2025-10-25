import type { BodyFrame, JointName } from '@trackeovrconia/proto';

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export const mapLandmarksToFrame = (landmarks: Landmark[], timestamp: number): BodyFrame => {
  const joints: BodyFrame['joints'] = {};
  const average = (indices: number[]): Landmark | undefined => {
    const found = indices.map((index) => landmarks[index]).filter(Boolean) as Landmark[];
    if (!found.length) return undefined;
    const sum = found.reduce(
      (acc, item) => ({
        x: acc.x + item.x,
        y: acc.y + item.y,
        z: acc.z + item.z,
        visibility: (acc.visibility ?? 0) + (item.visibility ?? 1),
      }),
      { x: 0, y: 0, z: 0, visibility: 0 },
    );
    return {
      x: sum.x / found.length,
      y: sum.y / found.length,
      z: sum.z / found.length,
      visibility: (sum.visibility ?? 0) / found.length,
    };
  };

  const mapSingle = (joint: JointName, index: number | number[]): void => {
    const data = Array.isArray(index) ? average(index) : landmarks[index];
    if (!data) return;
    joints[joint] = {
      pos: [data.x, data.y, data.z],
      rotQuat: [0, 0, 0, 1],
      conf: data.visibility ?? 1,
    };
  };

  mapSingle('hip', [23, 24]);
  mapSingle('chest', [11, 12]);
  mapSingle('head', 0);
  mapSingle('shoulder_l', 11);
  mapSingle('elbow_l', 13);
  mapSingle('wrist_l', 15);
  mapSingle('shoulder_r', 12);
  mapSingle('elbow_r', 14);
  mapSingle('wrist_r', 16);
  mapSingle('knee_l', 25);
  mapSingle('ankle_l', 27);
  mapSingle('foot_l', 31);
  mapSingle('knee_r', 26);
  mapSingle('ankle_r', 28);
  mapSingle('foot_r', 32);

  return { timestamp, joints };
};
