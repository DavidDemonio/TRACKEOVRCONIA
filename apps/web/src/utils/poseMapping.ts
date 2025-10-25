import type { BodyFrame, JointName } from '@trackeovrconia/proto';

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const jointMap: Record<JointName, number> = {
  hip: 0,
  chest: 12,
  head: 0,
  shoulder_l: 11,
  elbow_l: 13,
  wrist_l: 15,
  shoulder_r: 12,
  elbow_r: 14,
  wrist_r: 16,
  knee_l: 25,
  ankle_l: 27,
  foot_l: 31,
  knee_r: 26,
  ankle_r: 28,
  foot_r: 32,
};

export const mapLandmarksToFrame = (landmarks: Landmark[], timestamp: number): BodyFrame => {
  const joints: BodyFrame['joints'] = {};
  (Object.keys(jointMap) as JointName[]).forEach((joint) => {
    const index = jointMap[joint];
    const landmark = landmarks[index];
    if (!landmark) return;
    joints[joint] = {
      pos: [landmark.x, landmark.y, landmark.z],
      rotQuat: [0, 0, 0, 1],
      conf: landmark.visibility ?? 1,
    };
  });
  return { timestamp, joints };
};
