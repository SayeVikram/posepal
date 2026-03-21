import type { Keypoint } from '@tensorflow-models/pose-detection';

const MIN_SCORE = 0.2;

const CONNECTED_KEYPOINTS: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  color = '#22d3ee',
) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  for (const [a, b] of CONNECTED_KEYPOINTS) {
    const p1 = keypoints[a];
    const p2 = keypoints[b];
    if (!p1 || !p2) continue;
    if ((p1.score ?? 0) < MIN_SCORE || (p2.score ?? 0) < MIN_SCORE) continue;
    if (p1.x == null || p1.y == null || p2.x == null || p2.y == null) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (const kp of keypoints) {
    if ((kp.score ?? 0) < MIN_SCORE) continue;
    if (kp.x == null || kp.y == null) continue;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
