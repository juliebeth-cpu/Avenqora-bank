import { pool } from "./db.js";

const websiteId = 10;
const AUTOMATIC_STATUSES = new Set(["created", "scheduled", "preparing", "departed", "in_transit", "at_stop"]);
const AUTOMATIC_SOURCE = "package_tracking_automation";
let running = false;

function parseConfig(value: unknown): Record<string, any> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function positiveMinutes(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function stageTime(events: any[], status: string): Date | null {
  const matching = events
    .filter((event) => event.event_type === "journey_auto_state" && event.new_status === status)
    .sort((left, right) => new Date(right.event_time).getTime() - new Date(left.event_time).getTime());
  return matching[0] ? new Date(matching[0].event_time) : null;
}

function hasManualOverride(shipment: any, config: Record<string, any>, events: any[], current: string): boolean {
  const progression = config.automaticProgression;
  if (progression?.enabled === false || progression?.manualOverrideAt) return true;
  if (events.some((event) =>
    event.event_type !== "journey_created" &&
    event.source !== AUTOMATIC_SOURCE &&
    event.actor_type !== "system"
  )) return true;
  const displayStatus = String(shipment.status ?? "").toLowerCase();
  const expected = new Set([
    "created", "shipment created", "scheduled", "preparing", "departed",
    "in transit", "at stop", "arrived", "delivered", "completed",
  ]);
  return displayStatus.length > 0 && !expected.has(displayStatus.replace(/_/g, " ")) && current === "created";
}

function nextStatus(shipment: any, events: any[], now: Date): string | null {
  const current = String(shipment.journey_status ?? "created");
  const config = parseConfig(shipment.journey_config);
  const progression = config.automaticProgression ?? {};
  const createdAt = new Date(shipment.created_at);
  const due = (from: Date | null, minutes: number | null): boolean =>
    Boolean(from && minutes != null && now.getTime() >= from.getTime() + minutes * 60_000);

  if (current === "created" || current === "scheduled") {
    return due(createdAt, positiveMinutes(progression.preparingAfterMinutes) ?? 0) ? "preparing" : null;
  }
  if (current === "preparing") {
    const preparingAt = stageTime(events, "preparing") ?? createdAt;
    const departureAt = shipment.departure_at ? new Date(shipment.departure_at) : null;
    const configuredDeparture = positiveMinutes(progression.departedAfterMinutes);
    return Boolean(departureAt && now >= departureAt) || due(preparingAt, configuredDeparture) ? "departed" : null;
  }
  if (current === "departed") {
    const departedAt = stageTime(events, "departed") ?? (shipment.departure_at ? new Date(shipment.departure_at) : createdAt);
    return due(departedAt, positiveMinutes(progression.inTransitAfterMinutes) ?? 0) ? "in_transit" : null;
  }
  if (current === "in_transit" || current === "at_stop") {
    const arrivalAt = shipment.expected_arrival_at
      ? new Date(shipment.expected_arrival_at)
      : shipment.departure_at && Number(shipment.journey_duration_minutes) > 0
        ? new Date(new Date(shipment.departure_at).getTime() + Number(shipment.journey_duration_minutes) * 60_000)
        : null;
    return arrivalAt && now >= arrivalAt ? "arrived" : null;
  }
  return null;
}

async function processShipment(shipment: any, now: Date): Promise<void> {
  const current = String(shipment.journey_status ?? "created");
  if (!AUTOMATIC_STATUSES.has(current)) return;
  const eventsResult = await pool.query(
    "SELECT event_type, actor_type, source, new_status, event_time FROM tracking_events WHERE shipment_id=$1 ORDER BY event_time DESC",
    [shipment.id],
  );
  const events = eventsResult.rows;
  const config = parseConfig(shipment.journey_config);
  if (hasManualOverride(shipment, config, events, current)) return;
  const candidate = nextStatus(shipment, events, now);
  if (!candidate || candidate === current) return;

  const destination = shipment.destination_airport || "Destination Airport";
  const status = candidate === "arrived"
    ? "At Destination Airport — " + destination
    : candidate === "preparing" ? "Preparing"
      : candidate === "departed" ? "Departed"
        : candidate === "in_transit" ? "In Transit"
          : shipment.status;
  const eventKey = "shipment:" + shipment.id + ":automatic:" + current + "->" + candidate;
  const update = await pool.query(
    "UPDATE shipments SET journey_status=$1, status=$2, departure_at=CASE WHEN $1='departed' AND departure_at IS NULL THEN $3 ELSE departure_at END, updated_at=$3 WHERE id=$4 AND website_id=$5 AND journey_status=$6 RETURNING id",
    [candidate, status, now, shipment.id, websiteId, current],
  );
  if (!update.rowCount) return;
  await pool.query(
    "INSERT INTO tracking_events (shipment_id, website_id, event_type, actor_type, source, event_key, status, location, airport, description, event_time, created_at, previous_status, new_status) VALUES ($1,$2,'journey_auto_state','system',$3,$4,$5,$6,$7,$8,$9,$9,$10,$11) ON CONFLICT DO NOTHING",
    [
      shipment.id, websiteId, AUTOMATIC_SOURCE, eventKey, status,
      candidate === "arrived" ? "Destination Airport — " + destination : null,
      candidate === "arrived" ? destination : null,
      candidate === "arrived" ? status : "Shipment advanced automatically",
      now, current, candidate,
    ],
  );
}

async function runStandaloneTrackingAutomation(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const shipments = await pool.query(
      "SELECT * FROM shipments WHERE website_id=$1 AND journey_status = ANY($2::text[])",
      [websiteId, Array.from(AUTOMATIC_STATUSES)],
    );
    const now = new Date();
    for (const shipment of shipments.rows) await processShipment(shipment, now);
  } catch (error) {
    console.error("[standalone tracking] automation tick failed", error);
  } finally {
    running = false;
  }
}

export function startStandaloneTrackingAutomation(): () => void {
  const automationWebsiteType: string = "banking";
  if (automationWebsiteType !== "tracking" && automationWebsiteType !== "logistics") return () => {};
  void runStandaloneTrackingAutomation();
  const timer = setInterval(() => { void runStandaloneTrackingAutomation(); }, 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
