# Winter Watch — Model Card

## Model
Logistic Regression with route one-hot encoding, median imputation and standardisation.

## Target
ice_incidents > 0 at route-night level.

This is a rare-event target: 35 positive rows out of 7,560 (0.46%).
The model is therefore an evidence/risk signal, not an automatic treatment rule.

## Features
- route_id
- min_air_c
- min_ground_c
- min_dewpoint_c
- rain_mm
- hours_ground_at_or_below_0
- forecast_ground_c

## Validation
An 80/20 GroupShuffleSplit was performed with date as the group, so all
routes from a night stay in the same split.

Validation ROC-AUC: 0.9763.

Because the positive class is extremely rare, ROC-AUC alone is not enough to
justify operational deployment. Precision/recall and calibration should be
reviewed as the live system is developed.

## Role in Winter Watch
The model provides supporting hazard evidence. It does NOT override the
deterministic Winter Service Plan decision tree.

The plan remains the source of truth for:
1. ground-temperature threshold;
2. moisture test;
3. Priority 3 stock rule;
4. salt/truck availability;
5. treatment timing.

## Limitation
Historical ice incidents are sparse and are influenced by past human
treatment decisions. The model should not be interpreted as causal evidence
that a route's current priority must change.

Senior Engineer priority recommendations use the separate five-winter
treated-vs-untreated incident analysis.
