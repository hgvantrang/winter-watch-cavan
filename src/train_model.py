"""Train the Winter Watch exploratory hazard model.

Target: any ice incident on a route-night (ice_incidents > 0).
Validation is grouped by date so rows from the same night do not leak
between train and validation sets.

This script expects the assignment history.csv at data/history.csv.
"""
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

FEATURES = [
    "route_id", "min_air_c", "min_ground_c", "min_dewpoint_c",
    "rain_mm", "hours_ground_at_or_below_0", "forecast_ground_c"
]

def main():
    df = pd.read_csv("data/history.csv")
    y = (df["ice_incidents"] > 0).astype(int)
    X = df[FEATURES]

    cat = ["route_id"]
    num = FEATURES[1:]
    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
        ("num", Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler())
        ]), num)
    ])

    model = Pipeline([
        ("pre", pre),
        ("model", LogisticRegression(
            max_iter=5000, class_weight="balanced", C=0.5
        ))
    ])

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=df["date"]))
    model.fit(X.iloc[train_idx], y.iloc[train_idx])
    p = model.predict_proba(X.iloc[test_idx])[:, 1]

    print("Rows:", len(df))
    print("Gritting runs:", (df["gritted"].astype(str).str.lower() == "yes").sum())
    print("Salt tonnes:", round(df["salt_t"].sum(), 1))
    print("Positive ice-incident rows:", int(y.sum()))
    print("Validation ROC-AUC:", round(roc_auc_score(y.iloc[test_idx], p), 4))

if __name__ == "__main__":
    main()
