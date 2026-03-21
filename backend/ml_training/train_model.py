"""
Train a RandomForest classifier on extracted YOLO keypoint features.

Usage:
  python -m ml_training.train_model --features ml_training/data/features.npy \
                                     --labels   ml_training/data/labels.npy \
                                     --out      ml_training/models/pose_classifier.joblib
"""

import argparse
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report


def main(features_path: str, labels_path: str, out_path: str):
    X = np.load(features_path)
    y = np.load(labels_path)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    print(classification_report(y_test, clf.predict(X_test)))

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, out_path)
    print(f"Model saved to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--features", default="ml_training/data/features.npy")
    parser.add_argument("--labels", default="ml_training/data/labels.npy")
    parser.add_argument("--out", default="ml_training/models/pose_classifier.joblib")
    args = parser.parse_args()
    main(args.features, args.labels, args.out)
