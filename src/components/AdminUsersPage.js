import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";

/* =======================
   Small shared helpers (match directory pages)
======================= */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const API_BASE = process.env.REACT_APP_API_BASE_URL;


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

function userInitial(u) {
  const ch =
    (u?.first_name?.trim()?.[0] ||
      u?.last_name?.trim()?.[0] ||
      u?.email?.trim()?.[0] ||
      "?");
  return ch.toUpperCase();
}

function displayName(u) {
  const first = (u?.first_name || "").trim();
  const last = (u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || "User";
}

const safeLower = (v) => String(v ?? "").toLowerCase();

/* =======================
   Page
======================= */
export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // drafts per user: { [id]: { email, first_name, last_name, role } }
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // sorting (like other directories)
  const [sortBy, setSortBy] = useState("name"); // "name" | "email" | "role" | "created"
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const isMobile = useIsMobile(576);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "teacher",
    password: "",
    password_confirmation: "",
  });

  const load = () => {
    setErr(null);
    setLoading(true);

    api
      .get(`${API_BASE}/admin/users`, { withCredentials: true })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setUsers(list);

        // init drafts from server values
        const nextDrafts = {};
        list.forEach((u) => {
          nextDrafts[u.id] = {
            email: u.email ?? "",
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            role: u.role ?? "none",
          };
        });
        setDrafts(nextDrafts);
      })
      .catch((e) => setErr(e.response?.data?.errors?.join(", ") || "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const draftFor = (u) =>
    drafts[u.id] || {
      email: u.email ?? "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      role: u.role ?? "none",
    };

  const isChanged = (u) => {
    const d = draftFor(u);
    return (
      (d.email ?? "") !== (u.email ?? "") ||
      (d.first_name ?? "") !== (u.first_name ?? "") ||
      (d.last_name ?? "") !== (u.last_name ?? "") ||
      (d.role ?? "none") !== (u.role ?? "none")
    );
  };

  const setDraftField = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const saveUser = async (u) => {
    const d = draftFor(u);

    setErr(null);
    setSavingId(u.id);
    setSavedId(null);

    try {
      const res = await api.patch(
        `${API_BASE}/admin/users/${u.id}`,
        { user: { email: d.email, first_name: d.first_name, last_name: d.last_name, role: d.role } },
        { withCredentials: true }
      );

      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)));

      // sync draft to server response
      setDrafts((prev) => ({
        ...prev,
        [u.id]: {
          email: res.data.email ?? "",
          first_name: res.data.first_name ?? "",
          last_name: res.data.last_name ?? "",
          role: res.data.role ?? "none",
        },
      }));

      setSavedId(u.id);
      window.setTimeout(() => setSavedId(null), 1200);
    } catch (e) {
      setErr(e.response?.data?.errors?.join(", ") || "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id, email) => {
    setErr(null);
    try {
      await api.delete(`${API_BASE}/admin/users/${id}`, { withCredentials: true });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (e) {
      setErr(e.response?.data?.errors?.join(", ") || "Delete failed");
    }
  };

  const createUser = async () => {
    setErr(null);
    try {
      const res = await api.post(
        `${API_BASE}/admin/users`,
        { user: create },
        { withCredentials: true }
      );

      setUsers((prev) => [res.data, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [res.data.id]: {
          email: res.data.email ?? "",
          first_name: res.data.first_name ?? "",
          last_name: res.data.last_name ?? "",
          role: res.data.role ?? "none",
        },
      }));

      setShowCreate(false);
      setCreate({
        email: "",
        first_name: "",
        last_name: "",
        role: "teacher",
        password: "",
        password_confirmation: "",
      });
    } catch (e) {
      setErr(e.response?.data?.errors?.join(", ") || "Create failed");
    }
  };

  const StatusLine = ({ u }) => {
    const changed = isChanged(u);
    if (savingId === u.id) return <span className="text-muted">Saving…</span>;
    if (savedId === u.id) return <span className="text-success">Saved ✓</span>;
    if (changed) return <span className="text-warning">Unsaved changes</span>;
    return null;
  };

  /* =======================
     Filter + sort + paginate
  ======================= */
  const filteredSorted = useMemo(() => {
    const s = q.trim().toLowerCase();

    const base = (!s
      ? users
      : users.filter((u) => {
          const d = drafts[u.id] || u;
          return `${u.email} ${u.first_name} ${u.last_name} ${u.role} ${d.email} ${d.first_name} ${d.last_name} ${d.role}`
            .toLowerCase()
            .includes(s);
        })
    ).slice();

    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortBy === "email") return safeLower(a.email).localeCompare(safeLower(b.email)) * dir;
      if (sortBy === "role") return safeLower(a.role).localeCompare(safeLower(b.role)) * dir;

      if (sortBy === "created") {
        const ad = a.created_at ? new Date(a.created_at).getTime() : null;
        const bd = b.created_at ? new Date(b.created_at).getTime() : null;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return (ad - bd) * dir;
      }

      // name (default): last, first
      const al = safeLower(a.last_name);
      const bl = safeLower(b.last_name);
      if (al !== bl) return al.localeCompare(bl) * dir;
      return safeLower(a.first_name).localeCompare(safeLower(b.first_name)) * dir;
    });

    return base;
  }, [users, q, sortBy, sortDir, drafts]);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize, sortBy, sortDir]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, safePage, pageSize]);

  const showingFrom = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, total);

  const pageButtons = buildPageButtons(safePage, totalPages);

  return (
    <div className="container" style={{ maxWidth: 1100, marginTop: 16 }}>
      {/* ===== Directory-style toolbar (matches your other pages) ===== */}
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
            Admin • System Users
          </div>

          <div className="d-flex gap-2">
         

            <Button
              size="sm"
              className="rounded-pill px-3"
              onClick={() => setShowCreate(true)}
              style={{ borderRadius: 999,fontSize: 12 }}
            >
              + New User
            </Button>
          </div>
        </div>

        {/* Row 2: Sort + asc/desc + search + per page + reset */}
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
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
            <option value="created">Date Created</option>
          </Form.Select>

          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </Button>

          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260 }}>
            <Form.Control
              size="sm"
              placeholder="Search by email, name, role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
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

          {(q.trim() || sortBy !== "name" || sortDir !== "asc") && (
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => {
                setQ("");
                setSortBy("name");
                setSortDir("asc");
              }}
              style={{ borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}
              title="Reset filters"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Row 3: count + top pagination (optional) */}
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

      {err && <Alert variant="danger">{err}</Alert>}

      {/* ===== Cards list (same as your current admin page) ===== */}
      <div
        className="d-grid"
        style={{
          gap: 16,
          gridTemplateColumns: "1fr",
        }}
      >
        {pageItems.map((u) => {
          const d = draftFor(u);
          const changed = isChanged(u);

          return (
            <Card key={u.id} className="h-100">
              <Card.Body>
                {/* Header row */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                  <div className="d-flex align-items-start gap-3" style={{ minWidth: 0 }}>
                    {/* Initial bubble */}
                    <div
                      className="d-flex align-items-center justify-content-center fw-semibold"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "#e9ecef",
                        flex: "0 0 auto",
                      }}
                      aria-hidden="true"
                      title={displayName(d)}
                    >
                      {userInitial(d)}
                    </div>

                    {/* Name + email + status */}
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-semibold" style={{ wordBreak: "break-word" }}>
                        {displayName(d)}
                      </div>
                      <div className="text-muted" style={{ fontSize: 12, wordBreak: "break-word" }}>
                        {d.email}
                      </div>
                      <div className="mt-1" style={{ fontSize: 12 }}>
                        <StatusLine u={u} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex flex-row flex-md-column gap-2 ms-md-auto">
                    <Button
                      variant={changed ? "primary" : "outline-secondary"}
                      size="sm"
                      onClick={() => saveUser(u)}
                      disabled={!changed || savingId === u.id}
                    >
                      {savingId === u.id ? "Saving..." : "Save"}
                    </Button>

                    <Button
                      variant="outline-danger"
                      size="sm"
                      disabled={savingId === u.id}
                      onClick={() => {
                        const ok = window.confirm(`Delete ${u.email}? This is permanent.`);
                        if (ok) deleteUser(u.id, u.email);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <hr className="my-3" />

                {/* Desktop: wider/inline, Mobile: stacks naturally */}
                <div className="d-grid" style={{ gap: 12 }}>
                  <div className="d-grid d-md-flex" style={{ gap: 12 }}>
                    <Form.Group className="flex-grow-1" style={{ minWidth: 220 }}>
                      <Form.Label className="text-muted" style={{ fontSize: 12 }}>
                        Email
                      </Form.Label>
                      <Form.Control
                        value={d.email}
                        disabled={savingId === u.id}
                        onChange={(e) => setDraftField(u.id, "email", e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group style={{ width: 180 }}>
                      <Form.Label className="text-muted" style={{ fontSize: 12 }}>
                        Role
                      </Form.Label>
                      <Form.Select
                        value={d.role}
                        disabled={savingId === u.id}
                        onChange={(e) => setDraftField(u.id, "role", e.target.value)}
                      >
                        <option value="none">none</option>
                        <option value="teacher">teacher</option>
                        <option value="admin">admin</option>
                      </Form.Select>
                    </Form.Group>
                  </div>

                  <div className="d-grid d-md-flex" style={{ gap: 12 }}>
                    <Form.Group className="flex-grow-1">
                      <Form.Label className="text-muted" style={{ fontSize: 12 }}>
                        First name
                      </Form.Label>
                      <Form.Control
                        value={d.first_name}
                        disabled={savingId === u.id}
                        onChange={(e) => setDraftField(u.id, "first_name", e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group className="flex-grow-1">
                      <Form.Label className="text-muted" style={{ fontSize: 12 }}>
                        Last name
                      </Form.Label>
                      <Form.Control
                        value={d.last_name}
                        disabled={savingId === u.id}
                        onChange={(e) => setDraftField(u.id, "last_name", e.target.value)}
                      />
                    </Form.Group>
                  </div>
                </div>
              </Card.Body>
            </Card>
          );
        })}

        {!loading && pageItems.length === 0 && <div className="text-muted">No users found.</div>}
      </div>

      {/* Bottom pagination (compact, consistent) */}
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

      {/* Create user modal (unchanged) */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create user</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">Admin-created accounts must have a password set.</Alert>

          <Form.Group className="mb-2">
            <Form.Label>Email</Form.Label>
            <Form.Control
              value={create.email}
              onChange={(e) => setCreate({ ...create, email: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>First name</Form.Label>
            <Form.Control
              value={create.first_name}
              onChange={(e) => setCreate({ ...create, first_name: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Last name</Form.Label>
            <Form.Control
              value={create.last_name}
              onChange={(e) => setCreate({ ...create, last_name: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Role</Form.Label>
            <Form.Select
              value={create.role}
              onChange={(e) => setCreate({ ...create, role: e.target.value })}
            >
              <option value="none">none</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </Form.Select>
            <div className="text-muted mt-1" style={{ fontSize: 12 }}>
              This sets the role for the new user.
            </div>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={create.password}
              onChange={(e) => setCreate({ ...create, password: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Password confirmation</Form.Label>
            <Form.Control
              type="password"
              value={create.password_confirmation}
              onChange={(e) =>
                setCreate({ ...create, password_confirmation: e.target.value })
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button onClick={createUser}>Create</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
