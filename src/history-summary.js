/**
 * Winter Watch — history.csv summarisation.
 * Process the complete history in code; only compact route summaries
 * should be passed to the LLM.
 */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function truthy(v) {
  return ["1", "true", "yes", "y"].includes(String(v).trim().toLowerCase());
}

export function summariseHistory(rows) {
  const byRoute = new Map();

  for (const row of rows) {
    const routeId = String(row.route_id ?? row.route ?? "");
    if (!byRoute.has(routeId)) {
      byRoute.set(routeId, {
        route_id: routeId,
        route: row.route ?? routeId,
        priority: row.priority,
        nights: 0,
        gritting_runs: 0,
        salt_t: 0,
        ice_incidents_treated: 0,
        ice_incidents_untreated: 0,
        treated_nights: 0,
        untreated_nights: 0,
        no_salt_nights: 0,
        freezing_nights: 0
      });
    }

    const s = byRoute.get(routeId);
    s.nights += 1;

    const treated = truthy(row.gritted);
    if (treated) {
      s.gritting_runs += 1;
      s.treated_nights += 1;
    } else {
      s.untreated_nights += 1;
    }

    s.salt_t += num(row.salt_t);

    const incidents = num(row.ice_incidents);
    if (treated) s.ice_incidents_treated += incidents;
    else s.ice_incidents_untreated += incidents;

    if (num(row.min_ground_c) <= 0) s.freezing_nights += 1;
    if (num(row.salt_t) <= 0) s.no_salt_nights += 1;
  }

  return [...byRoute.values()];
}

export function validateHistoryChecks(rows) {
  const summary = summariseHistory(rows);
  return {
    rows: rows.length,
    gritting_runs: summary.reduce((a, r) => a + r.gritting_runs, 0),
    salt_t: Number(summary.reduce((a, r) => a + r.salt_t, 0).toFixed(1)),
    required: { rows: 7560, gritting_runs: 439, salt_t: 1152.5 }
  };
}

export function buildLlmPayload(routeSummaries, tonightRoutes) {
  return routeSummaries.map(s => {
    const tonight = tonightRoutes.find(
      r => String(r.route_id) === String(s.route_id)
    );

    return {
      route_id: s.route_id,
      route: s.route,
      priority: s.priority,
      historical: {
        nights: s.nights,
        gritting_runs: s.gritting_runs,
        treated_nights: s.treated_nights,
        untreated_nights: s.untreated_nights,
        ice_incidents_treated: s.ice_incidents_treated,
        ice_incidents_untreated: s.ice_incidents_untreated,
        no_salt_nights: s.no_salt_nights
      },
      tonight: tonight ? {
        decision: tonight.decision,
        ground_c: tonight.ground_c,
        rain_mm: tonight.rain_mm,
        dew_point_c: tonight.dew_point_c,
        hazard_probability: tonight.hazard_probability ?? null
      } : null
    };
  });
}
