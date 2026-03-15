// src/components/MyLessonPlans.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import Form from "react-bootstrap/Form";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { CIcon } from "@coreui/icons-react";
import { cilCopy, cilPencil } from "@coreui/icons";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

/* =======================
   Pagination helpers
======================= */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildPageButtons(page, totalPages) {
  if (totalPages <= 1) return [{ type: "page", value: 1 }];

  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: "page", value: i + 1 }));
  }

  return [
    { type: "page", value: 1 },
    { type: "page", value: 2 },
    { type: "ellipsis", value: "mid" },
    { type: "page", value: totalPages - 1 },
    { type: "page", value: totalPages },
  ];
}

/* =======================
   Search helpers
======================= */
function matchesQuery(lp, query) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const title = (lp.title || "").toLowerCase();
  const desc = (lp.description || "").toLowerCase();
  return `${title} ${desc}`.includes(q);
}

/* =======================
   Sorting helpers
======================= */
const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatCreatedDate = (iso) => {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatNextDateTime = (iso) => {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatNextDateTimeMobile = (iso) => {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/* =======================
   Responsive helper
======================= */
function useIsMobile(bpPx = 576) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < bpPx
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < bpPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bpPx]);

  return isMobile;
}

/* =======================
   MyLessonPlans
======================= */
export default function MyLessonPlans() {
  const [lessonPlans, setLessonPlans] = useState([]);
  const [query, setQuery] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [duplicatingId, setDuplicatingId] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rosterId = searchParams.get("roster_id");

  const [sortBy, setSortBy] = useState("created");
  const [sortDir, setSortDir] = useState("desc");

  const isMobile = useIsMobile(576);

  const loadLessonPlans = useCallback(() => {
    const url = rosterId
      ? `/rosters/${rosterId}/lesson_plans_matching_schedule`
      : `/lesson_plans`;

    const params = rosterId ? { scope: "all" } : undefined;

    api
      .get(url, { params })
      .then((res) => {
        const data = res.data;

        if (rosterId) {
          const occs = Array.isArray(data) ? data : [];
          const byId = new Map();
          occs.forEach((occ) => {
            const lp = occ.lesson_plan;
            if (lp?.id) byId.set(lp.id, lp);
          });
          setLessonPlans(Array.from(byId.values()));
          return;
        }

        const items = Array.isArray(data)
          ? data
          : Array.isArray(data.lesson_plans)
          ? data.lesson_plans
          : Array.isArray(data.items)
          ? data.items
          : [];

        setLessonPlans(items);
      })
      .catch((err) => {
        console.error(err);
        setLessonPlans([]);
        setError("Failed to load lesson plans.");
      });
  }, [rosterId]);

  useEffect(() => {
    loadLessonPlans();
  }, [loadLessonPlans]);

  const filtered = useMemo(() => {
    const base = [...lessonPlans].filter((lp) => matchesQuery(lp, query));
    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortBy === "scheduled") {
        const ad = parseDate(a.next_scheduled_at);
        const bd = parseDate(b.next_scheduled_at);

        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;

        return (ad.getTime() - bd.getTime()) * dir;
      }

      const ad = parseDate(a.created_at);
      const bd = parseDate(b.created_at);

      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;

      return (ad.getTime() - bd.getTime()) * dir;
    });

    return base;
  }, [lessonPlans, query, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, sortBy, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, safePage, pageSize]);

  const showingFrom = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, total);
  const pageButtons = buildPageButtons(safePage, totalPages);

  const viewUrlFor = (lp) =>
    rosterId ? `/lesson-plans/${lp.id}?roster_id=${rosterId}` : `/lesson-plans/${lp.id}`;

  const editUrlFor = (lp) =>
    rosterId
      ? `/lesson-plans/${lp.id}?roster_id=${rosterId}`
      : `/lesson-plans/${lp.id}`;

  const handleDuplicate = async (e, lp) => {
    e.preventDefault();
    e.stopPropagation();

    setDuplicatingId(lp.id);
    setError("");
    setSuccess("");

    try {
      await api.post(`/lesson_plans/${lp.id}/duplicate`);
      setSuccess(`Duplicated "${lp.title || "lesson plan"}".`);
      loadLessonPlans();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.errors?.join(", ") ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to duplicate lesson plan."
      );
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleEdit = (e, lp) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(editUrlFor(lp));
  };

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {success ? (
        <div className="alert alert-success py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
          <span style={{ fontSize: 14 }}>{success}</span>
          <Button
            size="sm"
            variant="outline-secondary"
            className="rounded-pill px-3"
            style={{ fontSize: 12 }}
            onClick={() => setSuccess("")}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
          <span style={{ fontSize: 14 }}>{error}</span>
          <Button
            size="sm"
            variant="outline-secondary"
            className="rounded-pill px-3"
            style={{ fontSize: 12 }}
            onClick={() => setError("")}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* ===== Toolbar ===== */}
      <div
        className="border rounded-3 bg-white mb-3"
        style={{
          padding: isMobile ? 10 : 14,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div style={{ fontSize: "clamp(18px, 4.6vw, 22px)", letterSpacing: -0.2 }}>
            Lesson Plans
          </div>

          <Button
            as={Link}
            to="/lesson-plans/new"
            variant="primary"
            size="sm"
            className="rounded-pill px-3"
            style={{
              borderRadius: 999,
              fontSize: 12,
            }}
          >
            + New Lesson Plan
          </Button>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          <Form.Select
            size="sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              width: isMobile ? "100%" : 200,
              borderRadius: 12,
            }}
            aria-label="Sort by"
          >
            <option value="created">Date Created</option>
            <option value="scheduled">Next Scheduled</option>
          </Form.Select>

          <Button
            size="sm"
            variant="outline-secondary"
            className="rounded-pill px-3"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0, fontSize: 12 }}
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </Button>

          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
            <Form.Control
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lesson plans…"
              style={{ borderRadius: 12 }}
            />
          </div>

          <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>
            <span className="text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              Per page
            </span>
            <Form.Select
              size="sm"
              style={{ width: 96, borderRadius: 12 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Per page"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </Form.Select>
          </div>

          {(query.trim() || sortBy !== "created" || sortDir !== "desc") && (
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => {
                setQuery("");
                setSortBy("created");
                setSortDir("desc");
              }}
              style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0, fontSize: 12 }}
              title="Reset filters"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="text-muted" style={{ fontSize: 12 }}>
            {total > 0 ? (
              <>
                <span style={{ fontWeight: 800 }}>
                  {showingFrom}-{showingTo}
                </span>{" "}
                of <span style={{ fontWeight: 800 }}>{total}</span>
              </>
            ) : (
              <>0</>
            )}
          </div>

          {total > 0 && totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage <= 1}
                style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
              >
                ← Prev
              </Button>

              <div
                className="text-muted"
                style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Page {safePage} / {totalPages}
              </div>

              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={safePage >= totalPages}
                style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ===== Directory list ===== */}
      {total > 0 && (
        <div className="border rounded-3 overflow-hidden bg-white">
          {pageItems.map((lp) => {
            const nextLabel = lp.next_scheduled_at ? formatNextDateTime(lp.next_scheduled_at) : "—";
            const createdLabel = lp.created_at ? formatCreatedDate(lp.created_at) : "—";
            const viewUrl = viewUrlFor(lp);

            return (
              <Link
                key={lp.id}
                to={viewUrl}
                className="text-decoration-none"
                style={{ color: "inherit" }}
              >
                <div
                  className="px-3 py-3"
                  style={{
                    borderBottom: "1px solid #f1f3f5",
                    cursor: "pointer",
                    transition: "background 140ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fbfcfd")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="fw-semibold"
                        style={{
                          lineHeight: 1.15,
                          fontSize: 15,
                          wordBreak: "break-word",
                        }}
                      >
                        {lp.title || "Untitled lesson plan"}
                      </div>

                      <div
                        className="text-muted"
                        style={{
                          fontSize: 12,
                          marginTop: 4,
                          wordBreak: "break-word",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {lp.description ? String(lp.description) : "No description."}
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="rounded-pill px-2"
                        style={{ fontSize: 12, lineHeight: 1, borderWidth: 0 }}
                        title="Duplicate lesson plan"
                        aria-label={`Duplicate ${lp.title || "lesson plan"}`}
                        onClick={(e) => handleDuplicate(e, lp)}
                        disabled={duplicatingId === lp.id}
                      >
                        <CIcon icon={cilCopy} size="sm" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className="rounded-pill px-2"
                        style={{ fontSize: 12, lineHeight: 1, borderWidth: 0 }}
                        title="Edit lesson plan"
                        aria-label={`Edit ${lp.title || "lesson plan"}`}
                        onClick={(e) => handleEdit(e, lp)}
                      >
                        <CIcon icon={cilPencil} size="sm" />
                      </Button>

                      <span
                        className="btn btn-outline-secondary btn-sm flex-shrink-0 rounded-pill px-2"
                        style={{
                          border: 0,
                          padding: "6px 10px",
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                        title="View lesson plan"
                        aria-label={`View ${lp.title || "lesson plan"}`}
                      >
                        →
                      </span>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <span
                      className="text-muted"
                      style={{
                        fontSize: 12,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "rgba(13,110,253,0.08)",
                        border: "1px solid rgba(13,110,253,0.15)",
                        color: "#0d6efd",
                      }}
                      title={lp.next_scheduled_at ? nextLabel : "Not scheduled yet"}
                    >
                      <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>NEXT SCHEDULED</span>{" "}
                      <span style={{ opacity: 0.8 }}>•</span>{" "}
                      {isMobile && lp.next_scheduled_at
                        ? formatNextDateTimeMobile(lp.next_scheduled_at)
                        : nextLabel}
                    </span>

                    <span
                      className="text-muted"
                      style={{
                        fontSize: 12,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.03)",
                        border: "1px solid rgba(0,0,0,0.04)",
                      }}
                      title={createdLabel}
                    >
                      <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>DATE CREATED</span>{" "}
                      <span style={{ opacity: 0.8 }}>•</span>{" "}
                      {createdLabel}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {total === 0 && (
        <div className="text-muted">
          No lesson plans found. If you believe this is an error, please contact an administrator.
        </div>
      )}

      {total > 0 && totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
            disabled={safePage <= 1}
            style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
          >
            ← Prev
          </Button>

          <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>
            Page {safePage} / {totalPages}
          </div>

          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
            disabled={safePage >= totalPages}
            style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}