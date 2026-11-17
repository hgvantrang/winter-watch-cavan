# Winter Watch — County Cavan

A decision-support prototype for winter road treatment planning.

## What it does
Winter Watch is intended to help the County Cavan Duty Engineer answer:
1. Should the network be treated tonight?
2. Which routes should be reviewed first, and when should trucks leave?
3. Which routes may deserve priority review next winter?

The system combines weather, historical patterns, road-network context and ML risk prediction, then presents an explainable recommendation for a human engineer.

## Current status
**Phase 1 — public prototype UI.**

The current site contains the operational interface, provenance design and route-priority structure. Live forecast ingestion, historical feature engineering, model training and secure backend inference are deliberately not faked.

## Safety / governance
- Human engineer makes the final operational decision.
- No secret API keys belong in this repository.
- Prototype values are not operational measurements.
- Route-priority suggestions do not automatically change council policy.

See the docs/ directory for architecture, decision logic and provenance.

## Planned next phase
- Acquire 5+ winters of real historical weather.
- Connect live forecast data securely.
- Build route-level features.
- Train and validate a winter hazard-risk model.
- Build the decision engine.
- Add a secure API layer so public frontend code never exposes API secrets.
- Add model/data provenance to every operational number.
