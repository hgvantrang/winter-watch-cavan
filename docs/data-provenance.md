# Data provenance

Every operational number should retain:
- source
- retrieval timestamp
- data timestamp / forecast issue time
- transformation or feature version
- model version
- decision-rule version

## Planned sources
- Met Éireann: forecast and historical weather observations.
- County Cavan winter service documentation: official priority routes and operating context.
- data.gov.ie / Road Management Office: road-network data where appropriate.

## Prototype rule
The public interface intentionally displays placeholders instead of fabricated live measurements. This keeps the UI demonstrable without implying that a model or live feed has already been validated.
