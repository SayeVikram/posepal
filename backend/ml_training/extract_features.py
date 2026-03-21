"""
Extract YOLO keypoints from a labeled dataset directory.

Expected layout:
  data/
    correct_posture/
      video1.mp4
      ...
    incorrect_posture/
      video2.mp4
      ...

Outputs:
  ml_training/data/features.npy   shape (N, 51)
  ml_training/data/labels.npy     shape (N,)
"""

import argparse
import os
import numpy as np
import cv2
from pathlib import Path

from ultralytics import YOLO

FRAME_INTERVAL = 5


def extract_from_video(path: str, model: YOLO) -> list[np.ndarray]:
    cap = cv2.VideoCapture(path)
    features = []
    idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if idx % FRAME_INTERVAL == 0:
            results = model(frame, verbose=False)
            if results and results[0].keypoints is not None:
                kp = results[0].keypoints.xy.cpu().numpy()
                if len(kp) > 0:
                    conf = results[0].keypoints.conf.cpu().numpy()[0]
                    xy = kp[0].flatten()
                    features.append(np.concatenate([xy, conf]))
        idx += 1
    cap.release()
    return features


def main(data_dir: str, out_dir: str):
    model = YOLO("yolo11n-pose.pt")
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    all_features, all_labels = [], []

    for label in os.listdir(data_dir):
        class_dir = os.path.join(data_dir, label)
        if not os.path.isdir(class_dir):
            continue
        for video_file in os.listdir(class_dir):
            if not video_file.endswith((".mp4", ".avi", ".mov")):
                continue
            video_path = os.path.join(class_dir, video_file)
            print(f"Processing {video_path}")
            feats = extract_from_video(video_path, model)
            all_features.extend(feats)
            all_labels.extend([label] * len(feats))

    np.save(out_path / "features.npy", np.array(all_features))
    np.save(out_path / "labels.npy", np.array(all_labels))
    print(f"Saved {len(all_features)} samples to {out_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="ml_training/data/raw", help="Labeled video directory")
    parser.add_argument("--out", default="ml_training/data", help="Output directory")
    args = parser.parse_args()
    main(args.data, args.out)
