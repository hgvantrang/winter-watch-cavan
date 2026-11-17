# Decision logic

## Prediction target
The preferred ML target is the probability of hazardous winter road conditions rather than a historical "grit/no grit" label, because a complete and reliable archive of past treatment decisions may not be available.

## Decision engine
hazard probability + forecast timing + road exposure + official route priority + operational constraints → treatment recommendation.

Possible outputs:
- Grit
- Monitor
- No grit

Exact thresholds must be validated against historical winters and operational requirements before operational use.

## Human-in-the-loop
The Duty Engineer remains the final decision-maker. The interface should record the recommendation shown, engineer decision, accept/override, override reason and timestamp.

## Senior Engineer
Route priority review is evidence-led. Winter Watch may flag persistent risk, exposure or treatment gaps, but never automatically changes the official winter service plan.
