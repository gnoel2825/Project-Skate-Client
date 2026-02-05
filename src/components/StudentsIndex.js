// src/components/StudentsIndex.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


/* =======================
   Pagination helpers (same as Rosters)
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
   Responsive helper (same pattern)
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
   Avatar helpers (colored, consistent)
======================= */
const initialsFor = (s) => {
  const first = (s?.first_name || "").trim();
  const last = (s?.last_name || "").trim();
  const f = first ? first[0] : "";
  const l = last ? last[0] : "";
  const out = `${f}${l}`.toUpperCase();
  return out || "??";
};

const hashHue = (seed) => {
  const str = String(seed || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
};

const Avatar = ({ initials, seed, size = 30 }) => {
  const s = Number(size) || 30;
  const hue = hashHue(seed || initials || "??");
  const bg = `hsl(${hue} 70% 92%)`;
  const border = `hsl(${hue} 55% 80%)`;
  const text = `hsl(${hue} 40% 25%)`;

  return (
    <div
      aria-hidden="true"
      className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
      style={{
        width: s,
        height: s,
        fontSize: Math.max(11, Math.floor(s * 0.38)),
        fontWeight: 800,
        letterSpacing: 0.5,
        background: bg,
        border: `1px solid ${border}`,
        color: text,
      }}
      title={initials}
    >
      {initials}
    </div>
  );
};

/* =======================
   StudentsIndex (Functional, matches Lesson Plans look)
======================= */
export default function StudentsIndex({ currentUser }) {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // sorting
  const [sortBy, setSortBy] = useState("name"); // "name" | "created"
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const isMobile = useIsMobile(576);

  const canManage = ["teacher", "admin"].includes(currentUser?.role);

  const loadStudents = () => {
    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE}/students`, { withCredentials: true })
      .then((res) => {
        setStudents(Array.isArray(res.data) ? res.data : res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load students";
        setError(msg);
        setStudents([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = (students || []).filter((s) => {
      if (!q) return true;
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const email = (s.email || "").toLowerCase();
      return `${name} ${email}`.includes(q);
    });

    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortBy === "created") {
        const ad = a.created_at ? new Date(a.created_at).getTime() : null;
        const bd = b.created_at ? new Date(b.created_at).getTime() : null;

        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;

        return (ad - bd) * dir;
      }

      const al = (a.last_name || "").toLowerCase();
      const bl = (b.last_name || "").toLowerCase();
      if (al !== bl) return al.localeCompare(bl) * dir;

      const af = (a.first_name || "").toLowerCase();
      const bf = (b.first_name || "").toLowerCase();
      return af.localeCompare(bf) * dir;
    });

    return base;
  }, [students, query, sortBy, sortDir]);

  // reset pagination when controls change
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

  const formatCreated = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="container" style={{ maxWidth: 1100, marginTop: 16 }}>
      {/* ===== Toolbar (matches Lesson Plans) ===== */}
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
            Students
          </div>

          <div className="d-flex gap-2">
           

            {canManage && (
              <Button
                as={Link}
                to="/students/new"
                size="sm"
                className="rounded-pill px-3"
                variant="primary"
                style={{ fontSize: 12 }}
              >
                + New Student
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
            <option value="name">Name</option>
            <option value="created">Date Created</option>
          </Form.Select>

          {/* Asc/Desc */}
          <Button
            size="sm"
            variant="outline-secondary"
            className="rounded-pill px-3"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            style={{ fontSize: 12,borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}
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
              placeholder="Search students…"
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
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </Form.Select>
          </div>

          {/* Reset */}
          {(query.trim() || sortBy !== "name" || sortDir !== "asc") && (
            <Button
              size="sm"
                className="rounded-pill px-3"
                variant="primary"
              onClick={() => {
                setQuery("");
                setSortBy("name");
                setSortDir("asc");
              }}
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}
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
                className="rounded-pill px-3"
                variant="outline-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage <= 1}
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
                style={{ fontSize: 12 }}
                onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                disabled={safePage >= totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <p className="text-muted">Loading…</p>}

      {!loading && !error && students.length === 0 && (
        <Card>
          <Card.Body>
            <Card.Title className="mb-2">No students yet</Card.Title>
            <Card.Text className="text-muted mb-3">
              Add your first student to start building rosters.
            </Card.Text>
            {canManage && (
              <Link to="/students/new" className="btn btn-primary">
                Add a student
              </Link>
            )}
          </Card.Body>
        </Card>
      )}

      {/* ===== Directory list (stacked rows, no columns) ===== */}
      {!loading && !error && students.length > 0 && (
        <>
          {total === 0 ? (
            <div className="border rounded-3 p-4 bg-white">
              <div className="fw-semibold" style={{ fontSize: 16 }}>
                No students found
              </div>
              <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                Try a different search.
              </div>

              {canManage && (
                <div className="mt-3">
                  <Button as={Link} to="/students/new" variant="primary">
                    + Add student
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-3 overflow-hidden bg-white">
              {pageItems.map((s) => {
                const initials = initialsFor(s);
                const seed = s.id ?? s.email ?? `${s.first_name || ""}-${s.last_name || ""}`;
                const createdLabel = formatCreated(s.created_at);

                return (
                  <Link
                    key={s.id}
                    to={`/students/${s.id}`}
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
                      {/* Top row: Avatar + name/email + arrow */}
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
                          <Avatar initials={initials} seed={seed} size={30} />

                          <div style={{ minWidth: 0 }}>
                            <div
                              className="fw-semibold"
                              style={{ lineHeight: 1.15, fontSize: 15, wordBreak: "break-word" }}
                            >
                              {s.first_name || "Student"} {s.last_name || ""}
                            </div>

                            <div className="text-muted" style={{ fontSize: 12, marginTop: 4, wordBreak: "break-word" }}>
                              {s.email || "No email"}
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
                onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                disabled={safePage <= 1}
                style={{ borderRadius: 999, padding: "6px 10px", fontSize: 12 }}
                className="rounded-pill px-3"
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
                style={{ fontSize: 12, borderRadius: 999, padding: "6px 10px" }}
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
                className="rounded-pill px-3"
                    variant={it.value === safePage ? "primary" : "outline-secondary"}
                    onClick={() => setPage(it.value)}
                    style={{ fontSize: 12,borderRadius: 10, padding: "6px 10px" }}
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
