// src/components/RostersIndex.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";

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
   Directory helpers
======================= */
const rosterInitial = (r) => {
  const name = (r?.name || "").trim();
  const ch = name ? name[0].toUpperCase() : "#";
  return /[A-Z]/.test(ch) ? ch : "#";
};

const weekdayShort = (n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(n)] || "";

const formatTimeHHMM = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    const [hh, mm] = v.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatRange = (start, end) => {
  const s = formatTimeHHMM(start);
  const e = formatTimeHHMM(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s}–${e}`;
};

// Returns a short string like: "Mon/Wed 4:00–5:00"
const rosterMeetsLabel = (r) => {
  const sch = Array.isArray(r?.roster_schedules) ? r.roster_schedules : [];
  if (!sch.length) return "—";

  const groups = new Map(); // key => { days:[], start,end }
  for (const s of sch) {
    const key = `${s.starts_at || ""}|${s.ends_at || ""}`;
    if (!groups.has(key)) groups.set(key, { days: [], start: s.starts_at, end: s.ends_at });
    groups.get(key).days.push(s.weekday);
  }

  const parts = Array.from(groups.values())
    .map((g) => {
      const days = g.days
        .slice()
        .sort((a, b) => Number(a) - Number(b))
        .map(weekdayShort)
        .filter(Boolean);

      const dayStr = days.length ? days.join("/") : "";
      const timeStr = formatRange(g.start, g.end);
      return [dayStr, timeStr].filter(Boolean).join(" ");
    })
    .filter(Boolean);

  return parts.slice(0, 2).join(" • ") + (parts.length > 2 ? " • …" : "");
};

const hashHue = (seed) => {
  const str = String(seed || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
};

const MiniAvatar = ({ seed, text, size = 30 }) => {
  const s = Number(size) || 30;
  const hue = hashHue(seed || text || "X");
  const bg = `hsl(${hue} 70% 92%)`;
  const border = `hsl(${hue} 55% 80%)`;
  const color = `hsl(${hue} 40% 22%)`;

  return (
    <div
      aria-hidden="true"
      className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
      style={{
        width: s,
        height: s,
        fontSize: Math.max(11, Math.floor(s * 0.38)),
        fontWeight: 800,
        letterSpacing: 0.4,
        background: bg,
        border: `1px solid ${border}`,
        color,
      }}
      title={text}
    >
      {text}
    </div>
  );
};

/* =======================
   Responsive helper (same pattern as Lesson Plans)
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
   RostersIndex (Functional)
======================= */
export default function RostersIndex({ currentUser }) {
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // sorting
  const [sortBy, setSortBy] = useState("name"); // "name" | "students" | "scheduled"
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const isMobile = useIsMobile(576);

  const canManage = ["teacher", "admin"].includes(currentUser?.role);

  const loadRosters = () => {
    setLoading(true);
    setError(null);

    api
      .get(`/rosters.json`)
      .then((res) => {
        setRosters(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load rosters";
        setError(msg);
        setRosters([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRosters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filter + sort (BEFORE pagination)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = rosters.filter((r) => {
      if (!q) return true;
      const name = (r.name || "").toLowerCase();
      const teacher =
        `${r.teacher?.first_name || ""} ${r.teacher?.last_name || ""}`.trim().toLowerCase();
      return `${name} ${teacher}`.includes(q);
    });

    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortBy === "students") {
        const ac = Array.isArray(a.students) ? a.students.length : a.students_count ?? 0;
        const bc = Array.isArray(b.students) ? b.students.length : b.students_count ?? 0;
        return (ac - bc) * dir;
      }

      if (sortBy === "scheduled") {
        const ah = (Array.isArray(a.roster_schedules) && a.roster_schedules.length > 0) ? 1 : 0;
        const bh = (Array.isArray(b.roster_schedules) && b.roster_schedules.length > 0) ? 1 : 0;

        // when dir=desc, scheduled-first is usually desired. This keeps it intuitive:
        // - desc: scheduled (1) first
        // - asc: unscheduled (0) first
        if (ah !== bh) return (ah - bh) * dir;

        return (a.name || "").localeCompare(b.name || "") * dir;
      }

      // name
      return (a.name || "").localeCompare(b.name || "") * dir;
    });

    return base;
  }, [rosters, query, sortBy, sortDir]);

  // reset pagination when query / page size / sort changes
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

  return (
    <div className="container" style={{ maxWidth: 1100, marginTop: 16 }}>
      {/* ===== Toolbar (same pattern as Lesson Plans) ===== */}
      <div
        className="border rounded-3 bg-white mb-3"
        style={{
          padding: isMobile ? 10 : 14,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        {/* Row 1: Title + New */}
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div style={{ fontSize: "clamp(18px, 4.6vw, 22px)", letterSpacing: -0.2 }}>
            Rosters
          </div>

          <div className="d-flex gap-2">
            

            {canManage && (
              <Button
                as={Link}
                to="/rosters/new"
                variant="primary"
                size="sm"
                style={{ borderRadius: 999, fontSize: 12 }}
                className="rounded-pill px-3"
              >
                + New Roster
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Controls all on one line (wraps cleanly) */}
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
          {/* Sort */}
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
            <option value="name">Roster Name</option>
            <option value="students">Student Count</option>
            <option value="scheduled">Has Weekly Schedule</option>
          </Form.Select>

          {/* Asc/Desc */}
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

          {/* Search */}
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
            <Form.Control
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rosters…"
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

          {/* Reset */}
          {(query.trim() || sortBy !== "name" || sortDir !== "asc") && (
            <Button
              size="sm"
              variant="outline-secondary"
              className="rounded-pill px-3"
              onClick={() => {
                setQuery("");
                setSortBy("name");
                setSortDir("asc");
              }}
              style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0, fontSize: 12 }}
              title="Reset filters"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Row 3: Count + top pagination */}
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
                className="rounded-pill px-3"
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage <= 1}
                style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
              >
                ← Prev
              </Button>

              <div className="text-muted" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                Page {safePage} / {totalPages}
              </div>

              <Button
                size="sm"
                variant="outline-secondary"
                className="rounded-pill px-3"
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

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <p className="text-muted">Loading…</p>}

      {!loading && !error && rosters.length === 0 && (
        <Card>
          <Card.Body>
            <Card.Title className="mb-2">No rosters yet</Card.Title>
            <Card.Text className="text-muted mb-3">
              Create your first roster to group students.
            </Card.Text>
            <Link to="/rosters/new" style={{ fontSize: 12 }} className="btn btn-primary rounded-pill px-3">
              + New Roster
            </Link>
          </Card.Body>
        </Card>
      )}

      {/* ===== Directory list (stacked rows, no columns) ===== */}
      {!loading && !error && rosters.length > 0 && (
        <>
          {total === 0 ? (
            <div className="border rounded-3 p-4 bg-white">
              <div className="fw-semibold" style={{ fontSize: 16 }}>
                No rosters found
              </div>
              <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                Try a different search.
              </div>
            </div>
          ) : (
            <div className="border rounded-3 overflow-hidden bg-white">
              {pageItems.map((r) => {
                const count = Array.isArray(r.students) ? r.students.length : r.students_count ?? 0;
                const meets = rosterMeetsLabel(r);
                const teacherName = r.teacher
                  ? `${r.teacher.first_name || ""} ${r.teacher.last_name || ""}`.trim()
                  : "";

                return (
                  <Link key={r.id} to={`/rosters/${r.id}`} className="text-decoration-none" style={{ color: "inherit" }}>
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
                      {/* Top row: Avatar + title + arrow */}
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
                         

                          <div style={{ minWidth: 0 }}>
                            <div
                              className="fw-semibold"
                              style={{ lineHeight: 1.15, fontSize: 15, wordBreak: "break-word" }}
                            >
                              {r.name || "Untitled roster"}
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
                          title={meets === "—" ? "No weekly schedule set" : meets}
                        >
                          <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>WEEKLY SCHEDULE</span>{" "}
                          <span style={{ opacity: 0.8 }}>•</span> {meets}
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
                          title={`${count} students`}
                        >
                          <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>STUDENTS</span>{" "}
                          <span style={{ opacity: 0.8 }}>•</span> {count}
                        </span>
                      </div>
                            </div>
                          </div>
                        </div>

                        <span
                          className="btn btn-outline-secondary btn-sm flex-shrink-0"
                          style={{ border: 0, padding: "6px 10px", fontSize: 12 }}
                        >
                          →
                        </span>
                      </div>

                    
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Bottom pagination (compact) */}
          {total > 0 && totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3 gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                className="rounded-pill px-3"
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
                className="rounded-pill px-3"
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={safePage >= totalPages}
                style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
              >
                Next →
              </Button>
            </div>
          )}

          {/* Optional: full page buttons row */}
          {total > 0 && totalPages > 1 && (
            <div className="d-none d-sm-flex justify-content-center gap-2 mt-2 flex-wrap">
              {pageButtons.map((it, idx) =>
                it.type === "ellipsis" ? (
                  <span
                    key={`e-${it.value}-${idx}`}
                    className="text-muted"
                    style={{ fontSize: 12, padding: "0 4px", lineHeight: "32px" }}
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={`p-${it.value}`}
                    size="sm"
                    variant={it.value === safePage ? "primary" : "outline-secondary"}
                    onClick={() => setPage(it.value)}
                    style={{ borderRadius: 10, padding: "6px 10px" }}
                  >
                    {it.value}
                  </Button>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
