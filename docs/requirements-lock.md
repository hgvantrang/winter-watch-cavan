# Winter Watch — Requirements Lock

## Tonight route decision

For each route:

1. Ground threshold:
   - Priority 1: +1.0°C or lower
   - Priority 2: +0.5°C or lower
   - Priority 3: -1.0°C or lower
2. Moisture:
   - rain, OR
   - dew point within 1°C of ground temperature
3. Priority 3 only:
   - depot must be at least 40% full
4. Depot:
   - enough salt for the route
   - truck ready
5. Treat:
   - trucks finish spreading one hour before ground reaches 0°C
   - approximately 1 hour per 20 km
   - never leave before 17:00

## Five-winter history

Process the full history.csv in code.

Required validation totals:
- 7,560 rows
- 439 gritting runs
- 1,152.5 tonnes of salt

The LLM receives only the compact route-level summary, not the full history file.

The summary must support:
- ice incidents on treated nights
- ice incidents on untreated nights
- treated and untreated nights
- gritting runs
- salt use
- nights with no salt

## Senior Engineer judgement

Distinguish:
- routes that ice because they were not treated; and
- routes that ice despite being treated.

The recommendation must:
- name a route for priority review;
- give two numbers matching the summary;
- state one evidence limitation;
- end with a human-approvable/rejectable recommendation.

The tool recommends a review; it does not automatically change route priority.

## AI separation

The predictive ML model provides risk evidence.

The LLM explains a compact, code-generated payload.

The LLM must not:
- receive the raw 7,560-row file;
- override deterministic plan rules;
- make the final engineer decision.

## Security

Provider credentials must remain server-side / in deployment secrets.
No API key is stored in frontend JavaScript or committed to the public repository.
