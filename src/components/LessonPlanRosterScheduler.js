import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";

function formatLongDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

function formatShortTime(value) {
  if (!value) return "";

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(String(value))) {
    const [hh, mm] = String(value).split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(start, end) {
  const s = formatShortTime(start);
  const e = formatShortTime(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s} – ${e}`;
}

function rosterScheduleSummary(roster) {
  const schedules = Array.isArray(roster?.roster_schedules) ? roster.roster_schedules : [];
  if (!schedules.length) return "No weekly schedule";

  const weekdayShort = (n) =>
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(n)] || "";

  return schedules
    .slice(0, 3)
    .map((s) => `${weekdayShort(s.weekday)} ${formatTimeRange(s.starts_at, s.ends_at)}`)
    .join(" • ");
}

export default function LessonPlanRosterScheduler({
  lessonPlanId,
  initialRosterId = "",
  rosterLocked = false,
  title = "Schedule Lesson Plan",
  subtitle = "Choose a roster and one of its upcoming class times.",
  onScheduled,
}) {
  const [rosters, setRosters] = useState([]);
  const [loadingRosters, setLoadingRosters] = useState(true);

  const [selectedRosterId, setSelectedRosterId] = useState(initialRosterId ? String(initialRosterId) : "");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [mode, setMode] = useState("next"); // "next" | "choose"
  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRosters() {
      setLoadingRosters(true);
      setError("");

      try {
        const res = await api.get("/rosters.json");
        if (!mounted) return;

        const data = Array.isArray(res.data) ? res.data : [];
        setRosters(data);

        if (!initialRosterId && data.length === 1) {
          setSelectedRosterId(String(data[0].id));
        }
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.errors?.join(", ") ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load rosters"
        );
      } finally {
        if (mounted) setLoadingRosters(false);
      }
    }

    loadRosters();
    return () => {
      mounted = false;
    };
  }, [initialRosterId]);

  useEffect(() => {
    let mounted = true;

    async function loadSlots() {
      if (!selectedRosterId) {
        setSlots([]);
        setSelectedSlotKey("");
        return;
      }

      setLoadingSlots(true);
      setError("");
      setSuccess("");

      try {
        const res = await api.get(`/rosters/${selectedRosterId}/upcoming_slots`, {
          params: { days: 45 },
        });

        if (!mounted) return;

        const nextSlots = Array.isArray(res.data?.slots) ? res.data.slots : [];
        setSlots(nextSlots);

        const firstKey =
          nextSlots[0] &&
          `${nextSlots[0].taught_on}|${nextSlots[0].starts_at}|${nextSlots[0].ends_at}`;
        setSelectedSlotKey(firstKey || "");
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.errors?.join(", ") ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load roster times"
        );
        setSlots([]);
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      mounted = false;
    };
  }, [selectedRosterId]);

  const selectedRoster = useMemo(
    () => rosters.find((r) => String(r.id) === String(selectedRosterId)) || null,
    [rosters, selectedRosterId]
  );

  const nextSlot = slots[0] || null;

  const selectedSlot = useMemo(() => {
    if (mode === "next") return nextSlot;
    return (
      slots.find(
        (slot) =>
          `${slot.taught_on}|${slot.starts_at}|${slot.ends_at}` === selectedSlotKey
      ) || null
    );
  }, [mode, nextSlot, selectedSlotKey, slots]);

  const scheduleOccurrence = async () => {
    if (!lessonPlanId || !selectedRoster || !selectedSlot) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.post(`/lesson_plans/${lessonPlanId}/lesson_plan_occurrences`, {
        lesson_plan_occurrence: {
          roster_id: selectedRoster.id,
          taught_on: selectedSlot.taught_on,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          location: selectedSlot.location || "",
        },
      });

      setSuccess("Session scheduled.");
      if (onScheduled) onScheduled(selectedSlot);
    } catch (err) {
      setError(
        err?.response?.data?.errors?.join(", ") ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to schedule session"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body>
        <div className="mb-3">
          <div className="text-uppercase text-muted mb-1" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Schedule
          </div>
          <div className="fw-semibold" style={{ fontSize: 20 }}>
            {title}
          </div>
          <div className="text-muted mt-1" style={{ fontSize: 14 }}>
            {subtitle}
          </div>
        </div>

        {success ? <Alert variant="success">{success}</Alert> : null}
        {error ? <Alert variant="danger">{error}</Alert> : null}

        {loadingRosters ? (
          <div className="py-4 text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            <div className="mb-3">
              <Form.Label className="fw-semibold" style={{ fontSize: 14 }}>
                Roster
              </Form.Label>
              <Form.Select
                value={selectedRosterId}
                onChange={(e) => setSelectedRosterId(e.target.value)}
                disabled={rosterLocked}
                style={{ borderRadius: 12 }}
              >
                <option value="">Choose a roster…</option>
                {rosters.map((roster) => (
                  <option key={roster.id} value={roster.id}>
                    {roster.name}
                  </option>
                ))}
              </Form.Select>

              {selectedRoster ? (
                <div
                  className="border rounded-3 p-3 mt-3"
                  style={{ background: "#fcfcff", borderColor: "#e9ecef" }}
                >
                  <div className="fw-semibold">{selectedRoster.name}</div>
                  <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                    {rosterScheduleSummary(selectedRoster)}
                  </div>
                </div>
              ) : null}
            </div>

            {!selectedRosterId ? null : loadingSlots ? (
              <div className="py-3 text-center">
                <Spinner animation="border" size="sm" />
              </div>
            ) : slots.length === 0 ? (
              <Alert variant="warning" className="mb-0">
                No upcoming weekly or one-off meetings found for this roster.
              </Alert>
            ) : (
              <>
                <div className="mb-3">
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={mode === "next" ? "primary" : "outline-secondary"}
                      className="rounded-pill px-3"
                      style={{ fontSize: 12 }}
                      onClick={() => setMode("next")}
                    >
                      Next class
                    </Button>

                    <Button
                      size="sm"
                      variant={mode === "choose" ? "primary" : "outline-secondary"}
                      className="rounded-pill px-3"
                      style={{ fontSize: 12 }}
                      onClick={() => setMode("choose")}
                    >
                      Choose another class
                    </Button>
                  </div>
                </div>

                {mode === "next" ? (
                  <div
                    className="border rounded-4 p-3 mb-3"
                    style={{ background: "#fcfcff", borderColor: "#e9ecef" }}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">
                          {formatLongDate(nextSlot.taught_on)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 13 }}>
                          {formatTimeRange(nextSlot.starts_at, nextSlot.ends_at)}
                          {nextSlot.location ? ` • ${nextSlot.location}` : ""}
                        </div>
                      </div>

                      <Badge bg="light" text="dark" className="border">
                        {nextSlot.kind === "meeting" ? "One-off" : "Weekly"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="d-grid mb-3" style={{ gap: 10, maxHeight: 320, overflowY: "auto" }}>
                    {slots.map((slot) => {
                      const slotKey = `${slot.taught_on}|${slot.starts_at}|${slot.ends_at}`;
                      const active = selectedSlotKey === slotKey;

                      return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => setSelectedSlotKey(slotKey)}
                          className="w-100 text-start border rounded-4 p-3 bg-white"
                          style={{
                            borderColor: active ? "#86b7fe" : "#e9ecef",
                            boxShadow: active ? "0 0 0 3px rgba(13,110,253,0.08)" : "none",
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-3">
                            <div>
                              <div className="fw-semibold">{formatLongDate(slot.taught_on)}</div>
                              <div className="text-muted" style={{ fontSize: 13 }}>
                                {formatTimeRange(slot.starts_at, slot.ends_at)}
                                {slot.location ? ` • ${slot.location}` : ""}
                              </div>
                            </div>

                            <Badge bg="light" text="dark" className="border">
                              {slot.kind === "meeting" ? "One-off" : "Weekly"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Button
                  variant="primary"
                  className="rounded-pill px-3"
                  style={{ fontSize: 12 }}
                  disabled={saving || !selectedSlot || !selectedRoster}
                  onClick={scheduleOccurrence}
                >
                  {saving ? "Scheduling..." : "Schedule Session"}
                </Button>
              </>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
} 