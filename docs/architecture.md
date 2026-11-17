# Winter Watch — architecture

## Purpose
Winter Watch is a decision-support system for County Cavan's winter roads team. It combines live weather, historical weather, road-network context and an explainable ML risk score before a human engineer makes the final treatment decision.

## System flow
Live forecast + historical weather + road network → feature engineering → ML hazard-risk model → decision engine → Duty Engineer recommendation → human final decision.

A separate Senior Engineer view will use route-level evidence to support next-winter priority review.

## Design principles
- Prediction is not the decision.
- No operational value is presented without provenance.
- Human override is explicit.
- API keys and secrets never live in the frontend.
- Policy changes are recommendations for review, not automatic changes.

## Planned technical layers
1. Static public frontend hosted with GitHub Pages.
2. Secure backend/data service for API calls and model inference.
3. Historical weather ingestion and feature pipeline.
4. Versioned model and decision rules.
5. Audit/provenance metadata for displayed values.
