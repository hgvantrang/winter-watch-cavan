/**
 * Winter Watch — deterministic treatment decision engine.
 * Implements the Winter Service Plan rules.
 * ML risk is supporting evidence; it does not override the plan.
 */
export function groundThresholdC(priority) {
  const thresholds = { 1: 1.0, 2: 0.5, 3: -1.0 };
  return thresholds[priority];
}

export function moisturePossible({ rainMm, groundC, dewPointC }) {
  const wetFromRain = Number(rainMm) > 0;
  const wetFromDew = Math.abs(Number(dewPointC) - Number(groundC)) <= 1;
  return { wetFromRain, wetFromDew, possible: wetFromRain || wetFromDew };
}

export function decideRoute({
  priority, groundC, rainMm, dewPointC, depotStockT,
  depotCapacityT, saltNeededT, trucksReady, routeLengthKm, groundReachZeroAt
}) {
  const threshold = groundThresholdC(Number(priority));
  if (threshold === undefined) {
    return { decision: "FLAG", reason: "Unknown route priority." };
  }

  if (Number(groundC) > threshold) {
    return {
      decision: "DONT_TREAT",
      reason: "Ground temperature is above the route treatment threshold.",
      thresholdC: threshold
    };
  }

  const moisture = moisturePossible({ rainMm, groundC, dewPointC });
  if (!moisture.possible) {
    return {
      decision: "DONT_TREAT",
      reason: "No rain and dew point is more than 1°C from the ground.",
      thresholdC: threshold,
      moisture
    };
  }

  if (
    Number(priority) === 3 &&
    Number.isFinite(Number(depotCapacityT)) &&
    Number(depotStockT) / Number(depotCapacityT) < 0.40
  ) {
    return {
      decision: "HOLD_BACK",
      reason: "Priority 3 depot is below the 40% stock threshold.",
      thresholdC: threshold,
      moisture
    };
  }

  if (!trucksReady || Number(depotStockT) < Number(saltNeededT)) {
    return {
      decision: "FLAG",
      reason: "Depot does not have the required salt and/or a ready truck.",
      thresholdC: threshold,
      moisture
    };
  }

  return {
    decision: "TREAT",
    reason: "Temperature, moisture, stock and truck checks passed.",
    thresholdC: threshold,
    moisture,
    saltNeededT,
    departureAt: calculateDepartureTime({ groundReachZeroAt, routeLengthKm })
  };
}

export function calculateDepartureTime({ groundReachZeroAt, routeLengthKm }) {
  if (!groundReachZeroAt) return null;
  const zeroTime = new Date(groundReachZeroAt);
  const spreadingHours = Math.max(0, Number(routeLengthKm) / 20);
  const departureMs =
    zeroTime.getTime() -
    (spreadingHours + 1) * 60 * 60 * 1000;

  const earliest = new Date(zeroTime);
  earliest.setHours(17, 0, 0, 0);

  return new Date(Math.max(departureMs, earliest.getTime())).toISOString();
}
