import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import Badge from "react-bootstrap/Badge";
import { Link } from "react-router-dom";
import LessonPlanRosterScheduler from "./LessonPlanRosterScheduler";

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function lessonPlanSearchScore(plan, query) {
  const q = normalizeText(query);
  if (!q) return 0;

  const title = normalizeText(plan?.title);
  const desc = normalizeText(plan?.description);

  if (title === q) return 1000;
  if (title.startsWith(q)) return 800;
  if (title.includes(q)) return 600;
  if (desc.includes(q)) return 250;

  const titleWords = title.split(/\s+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);

  let partial = 0;
  qWords.forEach((word) => {
    if (titleWords.some((tw) => tw.startsWith(word))) partial += 80;
    else if (title.includes(word)) partial += 40;
    else if (desc.includes(word)) partial += 15;
  });

  return partial;
}

function planSubtitle(plan) {
  const updated = plan?.updated_at || plan?.created_at;
  if (!updated) return "";

  const d = new Date(updated);
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);

  return stamp ? `Updated ${stamp}` : "";
}

export default function RosterLessonPlanSchedulerCard({
  roster,
  onScheduled,
}) {
  const [lessonPlans, setLessonPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadLessonPlans() {
      setLoadingPlans(true);
      setError("");

      try {
        const res = await api.get("/lesson_plans");
        if (!mounted) return;

        const data = Array.isArray(res.data) ? res.data : [];
        const sorted = data
          .slice()
          .sort((a, b) => {
            const ad = new Date(a.updated_at || a.created_at || 0).getTime();
            const bd = new Date(b.updated_at || b.created_at || 0).getTime();
            return bd - ad;
          });

        setLessonPlans(sorted);
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.errors?.join(", ") ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load lesson plans"
        );
      } finally {
        if (mounted) setLoadingPlans(false);
      }
    }

    loadLessonPlans();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPlan = useMemo(
    () => lessonPlans.find((p) => String(p.id) === String(selectedLessonPlanId)) || null,
    [lessonPlans, selectedLessonPlanId]
  );

  const suggestions = useMemo(() => {
    if (!query.trim()) {
      return lessonPlans.slice(0, 8);
    }

    return lessonPlans
      .map((plan) => ({
        plan,
        score: lessonPlanSearchScore(plan, query),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((row) => row.plan);
  }, [lessonPlans, query]);

  const choosePlan = (plan) => {
    setSelectedLessonPlanId(String(plan.id));
    setQuery(plan.title || "");
  };

  return (
    <Card className="border-0 shadow-sm mt-3">
      <Card.Body>
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <div
              className="text-uppercase text-muted mb-1"
              style={{ fontSize: 11, letterSpacing: 0.6 }}
            >
              Lesson Planning
            </div>
            <div className="fw-semibold" style={{ fontSize: 20 }}>
              Upcoming Lessons
            </div>
            <div className="text-muted mt-1" style={{ fontSize: 13 }}>
              Pick a lesson plan, then choose an upcoming class time to schedule it.
            </div>
          </div>

          <div className="align-self-start">
            <Button
              as={Link}
              to={`/lesson-plans/new?roster_id=${roster.id}`}
              variant="outline-secondary"
              className="rounded-pill px-3"
              style={{ fontSize: 12 }}
            >
              + New Lesson Plan
            </Button>
          </div>
        </div>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        {loadingPlans ? (
          <div className="py-4 text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            <Form.Control
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setSelectedLessonPlanId("");
                }
              }}
              placeholder="Search lesson plans…"
              style={{ borderRadius: 12 }}
              className="mb-3"
            />

            <div
              className="border rounded-3 mb-3 bg-white"
              style={{
                maxHeight: 300,
                overflowY: "auto",
                borderColor: "#e9ecef",
              }}
            >
              {suggestions.length === 0 ? (
                <div className="p-3 text-muted" style={{ fontSize: 13 }}>
                  No matching lesson plans.
                </div>
              ) : (
                suggestions.map((plan) => {
                  const active = String(plan.id) === String(selectedLessonPlanId);

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => choosePlan(plan)}
                      className="w-100 text-start btn btn-light border-0 rounded-0"
                      style={{
                        padding: "12px 14px",
                        background: active ? "#f3f7ff" : "#fff",
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="fw-semibold"
                            style={{ fontSize: 14, lineHeight: 1.2 }}
                          >
                            {plan.title || "Untitled lesson plan"}
                          </div>

                          {planSubtitle(plan) ? (
                            <div
                              className="text-muted mt-1"
                              style={{ fontSize: 12, lineHeight: 1.2 }}
                            >
                              {planSubtitle(plan)}
                            </div>
                          ) : null}
                        </div>

                        {active ? (
                          <Badge bg="primary" className="flex-shrink-0">
                            Selected
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedLessonPlanId ? (
              <LessonPlanRosterScheduler
                lessonPlanId={selectedLessonPlanId}
                initialRosterId={roster.id}
                rosterLocked
                compact
                hideRosterSummary
                hideHeader
                onScheduled={onScheduled}
              />
            ) : null}
          </>
        )}
      </Card.Body>
    </Card>
  );
}