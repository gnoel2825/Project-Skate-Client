import React, { useMemo, useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function skillLabel(skill) {
  // adjust to match your backend fields
  return (
    skill?.name ||
    skill?.title ||
    skill?.label ||
    `Skill #${skill?.id ?? "?"}`
  );
}

export default function SkillPicker({
  title = "Skills",
  allSkills = [],
  selectedIds = new Set(),
  onAdd,     // (skill) => void
  onRemove,  // (skill) => void
  disabled = false,
  maxResults = 25
}) {
  const [q, setQ] = useState("");

  const selectedList = useMemo(() => {
    const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    return (allSkills || []).filter((s) => ids.has(String(s.id)));
  }, [allSkills, selectedIds]);

  const results = useMemo(() => {
    const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const query = norm(q);
    const base = (allSkills || []).filter((s) => !ids.has(String(s.id)));

    if (!query) return base.slice(0, maxResults);

    return base
      .filter((s) => {
        const name = norm(skillLabel(s));
        const category = norm(s?.category);
        const tags = Array.isArray(s?.tags) ? norm(s.tags.join(" ")) : "";
        return (
          name.includes(query) ||
          category.includes(query) ||
          tags.includes(query)
        );
      })
      .slice(0, maxResults);
  }, [allSkills, selectedIds, q, maxResults]);

  return (
    <Card style={{ borderRadius: 14 }}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-semibold">{title}</div>
          <Badge bg="secondary">{selectedList.length}</Badge>
        </div>

        <Form.Control
          type="text"
          placeholder="Search skills…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          style={{ borderRadius: 12 }}
        />

        <div className="form-text mt-1">
          Type to filter, then click a skill to add.
        </div>

        {/* Search results */}
        <div
          className="border rounded-3 mt-2"
          style={{ maxHeight: 220, overflowY: "auto", background: "#fff" }}
        >
          {results.length === 0 ? (
            <div className="p-2 text-muted" style={{ fontSize: 13 }}>
              No matches.
            </div>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-100 text-start btn btn-light border-0 rounded-0"
                onClick={() => onAdd?.(s)}
                disabled={disabled}
                style={{ padding: "10px 12px" }}
              >
                <div className="d-flex justify-content-between align-items-start" style={{ gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-semibold" style={{ fontSize: 13, lineHeight: 1.2 }}>
                      {skillLabel(s)}
                    </div>
                    {s?.category ? (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {s.category}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Add
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Selected skills */}
        <div className="mt-3">
          <div className="text-uppercase text-muted" style={{ fontSize: 11, letterSpacing: 0.6 }}>
            Selected
          </div>

          {selectedList.length === 0 ? (
            <div className="text-muted mt-2" style={{ fontSize: 13 }}>
              None yet.
            </div>
          ) : (
            <div className="d-grid mt-2" style={{ gap: 8 }}>
              {selectedList.map((s) => (
                <div
                  key={s.id}
                  className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-center"
                  style={{ background: "#fbfbfd", borderColor: "#e9ecef", gap: 10 }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-semibold" style={{ fontSize: 13, lineHeight: 1.2 }}>
                      {skillLabel(s)}
                    </div>
                    {s?.category ? (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {s.category}
                      </div>
                    ) : null}
                  </div>

                  <Button
                    size="sm"
                    variant="outline-danger"
                    className="rounded-pill px-3"
                    style={{ fontSize: 12, minWidth: 84 }}
                    onClick={() => onRemove?.(s)}
                    disabled={disabled}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
