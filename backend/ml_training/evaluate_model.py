"""
Evaluate a saved RandomForest model on a held-out test set.

Usage:
  python -m ml_training.evaluate_model --model ml_training/models/pose_classifier.joblib \
                                        --features ml_training/data/features.npy \
                                        --labels   ml_training/data/labels.npy
"""

import argparse
import numpy as np
import joblib
from sklearn.metrics import classification_report, confusion_matrix


def main(model_path: str, features_path: str, labels_path: str, test_size: float):
    X = np.load(features_path)
    y = np.load(labels_path)

    split = int(len(X) * (1 - test_size))
    X_test, y_test = X[split:], y[split:]

    clf = joblib.load(model_path)
    y_pred = clf.predict(X_test)

    print("=== Classification Report ===")
    print(classification_report(y_test, y_pred))
    print("=== Confusion Matrix ===")
    print(confusion_matrix(y_test, y_pred))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="ml_training/models/pose_classifier.joblib")
    parser.add_argument("--features", default="ml_training/data/features.npy")
    parser.add_argument("--labels", default="ml_training/data/labels.npy")
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()
    main(args.model, args.features, args.labels, args.test_size)
