/**
 * Face ID model version. Embeddings from different models can't be compared, so profiles saved with
 * another value are ignored by the kiosk until the member is scanned again.
 * ArcFace (InsightFace EfficientNet-B0, 512-d) on 5-point-aligned faces — see components/face/face-engine.ts.
 */
export const FACE_MODEL = "arcface-effb0-aligned-v1";
export const FACE_DIM = 512;
