import { useNavigate } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import api from "../api";
import React, { useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


function DangerZone({ setCurrentUser }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  const deleteAccount = async () => {
  setBusy(true);
  setErr(null);

  try {
    await api.delete(`/account`, { withCredentials: true });

    // Clear any frontend auth state
    setCurrentUser(null);

    // If you store user anywhere, clear it here too:
    localStorage.removeItem("currentUser");
    localStorage.removeItem("user");
    sessionStorage.clear();

    // HARD redirect so you cannot remain on /settings and fire more API calls
    window.location.replace("/");
    return;
  } catch (e) {
    console.error(e);
    setErr("Could not delete account. Please try again.");
  } finally {
    setBusy(false);
    setShow(false);
    setConfirmText("");
  }
};

const pillBtn = {
    borderRadius: 999,
    fontSize: 12,
    padding: "6px 12px",
    lineHeight: 1.1
  };

  return (
    <>
      <Card className="mt-4 border-danger">
        <Card.Body>
          <Alert variant="danger" className="mb-3">
            <strong>Deleting your account is permanent.</strong> Your account and associated data will be removed and cannot be recovered.
          </Alert>
          <Button style={pillBtn} variant="danger" onClick={() => setShow(true)}>
            Delete my account
          </Button>
        </Card.Body>
      </Card>

      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Delete account permanently?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Alert variant="danger">
            This cannot be undone. Your account and associated data will be permanently deleted.
          </Alert>

          <Form.Group>
            <Form.Label>
              Type <strong>DELETE</strong> to confirm:
            </Form.Label>
            <Form.Control
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </Form.Group>

          {err && (
            <Alert variant="warning" className="mt-3">
              {err}
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShow(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteAccount} disabled={!canDelete || busy}>
            {busy ? "Deleting..." : "Yes, delete my account"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default DangerZone;