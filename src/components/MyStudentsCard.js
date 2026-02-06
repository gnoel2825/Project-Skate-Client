import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import { Link } from "react-router-dom";

import { CIcon } from "@coreui/icons-react";
import { cilChevronRight } from "@coreui/icons";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

function displayNameFL(s) {
  const first = (s.first_name || "").trim();
  const last = (s.last_name || "").trim();
  const name = `${first} ${last}`.replace(/\s+/g, " ").trim();
  return name || "Unnamed student";
}

function initialsFL(s) {
  const first = (s.first_name || "").trim();
  const last = (s.last_name || "").trim();
  const a = first ? first[0] : "";
  const b = last ? last[0] : "";
  const out = `${a}${b}`.toUpperCase();
  return out || "?";
}

function hashToHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

function Avatar({ seed, text }) {
  const hue = hashToHue(String(seed ?? text ?? ""));
  return (
    <div
      aria-hidden="true"
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 0.5,
        background: `hsl(${hue} 55% 92%)`,
        color: `hsl(${hue} 35% 28%)`,
        border: "1px solid rgba(0,0,0,0.08)",
        flex: "0 0 auto",
      }}
      title={text}
    >
      {text}
    </div>
  );
}

const SectionKicker = ({ children, className = "", style = {} }) => (
  <div
    className={`text-uppercase text-muted ${className}`}
    style={{ fontSize: 11, letterSpacing: 0.6, ...style }}
  >
    {children}
  </div>
);

const uniqById = (arr) => {
  const m = new Map();
  (arr || []).forEach((s) => {
    if (!s?.id) return;
    m.set(String(s.id), s);
  });
  return Array.from(m.values());
};

const pickBirthday = (s) =>
  s?.birthday || s?.birthdate || s?.date_of_birth || s?.dob || null;

const normalizeYmd = (v) => {
  if (!v) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const str = String(v).trim();
  if (!str) return null;

  const iso = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const us = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const mm = String(us[1]).padStart(2, "0");
    const dd = String(us[2]).padStart(2, "0");
    const yyyy = us[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

const birthdayMonthDay = (value) => {
  const ymd = normalizeYmd(value);
  if (!ymd) return null;
  const [, m, d] = ymd.split("-").map(Number);
  if (!m || !d) return null;
  return { month: m, day: d };
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (a, b) => {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

const birthdayDistance = (month, day) => {
  const today = startOfDay(new Date());
  const year = today.getFullYear();

  const thisYear = new Date(year, month - 1, day);
  const nextYear = new Date(year + 1, month - 1, day);

  const diffThis = daysBetween(today, thisYear);
  const next = diffThis >= 0 ? thisYear : nextYear;

  const daysUntil = daysBetween(today, next);
  const prev = diffThis <= 0 ? thisYear : new Date(year - 1, month - 1, day);
  const daysSince = Math.abs(daysBetween(prev, today));

  return { daysUntil, daysSince };
};

const prettyMonthDay = (month, day) => {
  const dt = new Date(2000, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(dt);
};

export default function MyStudentsCard({
  title = "My Students",
  endpoint = `/students_from_rosters`,
  initialLimit = 5,
}) {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const birthdayBadgeCount =
  Math.min(upcomingBirthdays.length, 3) + Math.min(recentBirthdays.length, 2);


  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .get(endpoint)
      .then((res) => setStudents(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load students";
        setError(msg);
        setStudents([]);
      })
      .finally(() => setLoading(false));
  }, [endpoint]);

  const uniqueStudents = useMemo(() => uniqById(students), [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueStudents;

    return uniqueStudents.filter((s) => {
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const email = (s.email || "").toLowerCase();
      return `${name} ${email}`.includes(q);
    });
  }, [uniqueStudents, query]);

  useEffect(() => {
    if (query.trim()) setShowAll(true);
  }, [query]);

  const { upcomingBirthdays, recentBirthdays } = useMemo(() => {
  const UPCOMING_DAYS = 30;
  const RECENT_DAYS = 14;

  const items = uniqueStudents
    .map((s) => {
      const md = birthdayMonthDay(pickBirthday(s));
      if (!md) return null;
      const dist = birthdayDistance(md.month, md.day);
      return { student: s, month: md.month, day: md.day, ...dist };
    })
    .filter(Boolean);

  const upcoming = items
    .filter((x) => x.daysUntil >= 0 && x.daysUntil <= UPCOMING_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // ✅ prevent double counting: if it's "upcoming", don't also show as "recent"
  const upcomingIds = new Set(upcoming.map((x) => String(x.student?.id)));

  const recent = items
    .filter(
      (x) =>
        x.daysSince >= 0 &&
        x.daysSince <= RECENT_DAYS &&
        !upcomingIds.has(String(x.student?.id))
    )
    .sort((a, b) => a.daysSince - b.daysSince);

  return { upcomingBirthdays: upcoming, recentBirthdays: recent };
}, [uniqueStudents]);


  const visible = showAll ? filtered : filtered.slice(0, initialLimit);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  return (
    <Card className="mt-3">
      <Card.Body>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Card.Title className="mb-0">
            <SectionKicker>
              {title} <Badge bg="secondary">{filtered.length}</Badge>
            </SectionKicker>
          </Card.Title>
        </div>

        {/* Birthdays */}
        {!loading && !error && (upcomingBirthdays.length > 0 || recentBirthdays.length > 0) && (
          <div
            className="border rounded p-2 mb-3"
            style={{ background: "#fbfcfd", borderColor: "rgba(0,0,0,0.06)" }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <SectionKicker>Birthdays</SectionKicker>
              <Badge bg="light" text="dark" style={{ fontWeight: 700 }}>
                {birthdayBadgeCount}
              </Badge>
            </div>

            {/* Upcoming */}
            {upcomingBirthdays.slice(0, 3).map((x) => {
              const s = x.student;
              const when =
                x.daysUntil === 0 ? "Today" : x.daysUntil === 1 ? "Tomorrow" : `In ${x.daysUntil}d`;

              return (
                <Link
                  key={`up-${s.id}`}
                  to={`/students/${s.id}`}
                  className="text-decoration-none"
                  style={{ color: "inherit" }}
                >
                  <div className="d-flex align-items-center justify-content-between gap-2 py-1">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <Avatar seed={s.id ?? `${s.first_name}-${s.last_name}`} text={initialsFL(s)} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650, fontSize: 13, lineHeight: 1.2 }}>
                          {displayNameFL(s)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {prettyMonthDay(x.month, x.day)} • {when}
                        </div>
                      </div>
                    </div>
                    <span className="text-muted" style={{ fontSize: 12 }}>→</span>
                  </div>
                </Link>
              );
            })}

            {/* Recent */}
            {recentBirthdays.slice(0, 2).map((x) => {
              const s = x.student;
              const when = x.daysSince === 0 ? "Today" : `${x.daysSince}d ago`;

              return (
                <Link
                  key={`re-${s.id}`}
                  to={`/students/${s.id}`}
                  className="text-decoration-none"
                  style={{ color: "inherit" }}
                >
                  <div className="d-flex align-items-center justify-content-between gap-2 py-1">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <Avatar seed={s.id ?? `${s.first_name}-${s.last_name}`} text={initialsFL(s)} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650, fontSize: 13, lineHeight: 1.2 }}>
                          {displayNameFL(s)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {prettyMonthDay(x.month, x.day)} • {when}
                        </div>
                      </div>
                    </div>
                    <span className="text-muted" style={{ fontSize: 12 }}>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Search */}
        <Form.Control
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="mb-3"
        />

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-muted">Loading…</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-muted">No students found.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="d-grid" style={{ gap: 10 }}>
              {visible.map((s) => (
                <div
                  key={s.id}
                  className="d-grid align-items-center"
                  style={{
                    gridTemplateColumns: "auto 1fr auto",
                    columnGap: 12,
                    rowGap: 6,
                  }}
                >
                  <Avatar seed={s.id ?? `${s.first_name}-${s.last_name}`} text={initialsFL(s)} />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, wordBreak: "break-word" }}>
                      {displayNameFL(s)}
                    </div>
                    <div className="text-muted" style={{ fontSize: 13, wordBreak: "break-word" }}>
                      {s.email ? s.email : "No email"}
                    </div>
                  </div>

                  <Link
                    to={`/students/${s.id}`}
                    className="text-decoration-none"
                    aria-label={`View ${displayNameFL(s)}`}
                    title="View"
                    style={{
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "inherit",
                      background: "white",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <span className="text-muted" style={{ fontSize: 12 }}>→</span>
                  </Link>
                </div>
              ))}
            </div>

            {/* Toggle */}
            {!query.trim() && filtered.length > initialLimit && (
              <div className="d-flex justify-content-center mt-3">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Show less" : `View ${hiddenCount} more`}
                </Button>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
