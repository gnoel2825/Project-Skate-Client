// src/components/MyLessonPlans.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import { Link, useSearchParams } from "react-router-dom";
import Button from "react-bootstrap/Button";

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

// more compact for mobile (prevents squish)
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

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [searchParams] = useSearchParams();
  const rosterId = searchParams.get("roster_id"); // e.g. /lesson-plans?roster_id=1

  // sorting
  const [sortBy, setSortBy] = useState("created"); // "created" | "scheduled"
  const [sortDir, setSortDir] = useState("desc"); // "asc" | "desc"

  const isMobile = useIsMobile(576);

  useEffect(() => {
    const url = rosterId
      ? `http://localhost:3000/rosters/${rosterId}/lesson_plans_matching_schedule`
      : "http://localhost:3000/lesson_plans";

    const params = rosterId ? { scope: "all" } : undefined;

    axios
      .get(url, { withCredentials: true, params })
      .then((res) => {
        const data = res.data;

        // If rosterId exists, this endpoint returns OCCURRENCES.
        // Convert occurrences -> unique lesson plans.
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

        // Otherwise: normal /lesson_plans response (array or wrapped)
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
      });
  }, [rosterId]);

  // filter + sort (BEFORE pagination)
  const filtered = useMemo(() => {
    const base = [...lessonPlans].filter((lp) => matchesQuery(lp, query));
    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortBy === "scheduled") {
        const ad = parseDate(a.next_scheduled_at);
        const bd = parseDate(b.next_scheduled_at);

        // unscheduled at bottom
        if (!ad && !bd) return 0;
        if (!ad) return 1;
        if (!bd) return -1;

        return (ad.getTime() - bd.getTime()) * dir;
      }

      // created
      const ad = parseDate(a.created_at);
      const bd = parseDate(b.created_at);

      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;

      return (ad.getTime() - bd.getTime()) * dir;
    });

    return base;
  }, [lessonPlans, query, sortBy, sortDir]);

  // reset pagination when query changes
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

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* ===== Toolbar ===== */}
<div
  className="border rounded-3 bg-white mb-3"
  style={{
    padding: isMobile ? 10 : 14,
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  }}
>
  {/* Row 1: Title + New */}
  <div className="d-flex justify-content-between align-items-center gap-2">
    <div style={{ fontSize: "clamp(18px, 4.6vw, 22px)", letterSpacing: -0.2}}>
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
        fontSize: 12
      }}
    >
      + New Lesson Plan
    </Button>
  </div>

  {/* Row 2: Controls all on one line (wraps cleanly) */}
  <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
    {/* Sort select */}
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

    {/* Asc/Desc toggle */}
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

    {/* Search (takes remaining space on desktop) */}
    <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
      <Form.Control
        size="sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search lesson plans…"
        style={{ borderRadius: 12 }}
      />
    </div>

    {/* Per page */}
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

    {/* Reset (optional, stays in same row) */}
    {(query.trim() || sortBy !== "created" || sortDir !== "desc") && (
      <Button
        size="sm"
        variant="outline-secondary"
        onClick={() => {
          setQuery("");
          setSortBy("created");
          setSortDir("desc");
        }}
        style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}
        title="Reset filters"
      >
        Reset
      </Button>
    )}
  </div>

  {/* Row 3: Count (closer to list) */}
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

    {/* Optional: keep top pagination here if you want it above the list */}
    {total > 0 && totalPages > 1 && (
      <div className="d-flex align-items-center gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
          disabled={safePage <= 1}
          style={{ borderRadius: 999, padding: "6px 10px" }}
        >
          ← Prev
        </Button>

        <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          Page {safePage} / {totalPages}
        </div>

        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
          disabled={safePage >= totalPages}
          style={{ borderRadius: 999, padding: "6px 10px" }}
        >
          Next →
        </Button>
      </div>
    )}
  </div>
</div>


      {/* ===== Directory list (stacked rows, no columns) ===== */}
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
            {/* Top row: Title + Open */}
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

                {/* Description */}
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

              <span
                className="btn btn-outline-secondary btn-sm flex-shrink-0"
                style={{
                  border: 0,
                  padding: "6px 10px",
                  fontSize: 12,
                }}
              >
               →
              </span>
            </div>

            {/* Meta chips */}
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
                {nextLabel}
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

      {/* Bottom pagination (keep, but compact) */}
      {total > 0 && totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3 gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
            disabled={safePage <= 1}
            style={{ borderRadius: 999, padding: "6px 10px" }}
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
            style={{ borderRadius: 999, padding: "6px 10px" }}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
