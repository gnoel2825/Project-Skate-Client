import React, { Component } from "react";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";

const API_BASE = process.env.REACT_APP_API_BASE_URL;


function withRouter(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    return <Component {...props} params={params} navigate={navigate} />;
  };
}

class RosterForm extends Component {
  state = {
    loading: false,
    saving: false,
    error: null,
    success: null,
    name: "",

     // existing
    name: "",
    selectedStudentIds: new Set(),

  // new
    allStudents: [],
    query: ""
  };

  componentDidMount() {
    const { id } = this.props.params;
    if (id) this.loadRoster();
  }

  loadRoster = () => {
    const { id } = this.props.params;
    this.setState({ loading: true, error: null });

    api
      .get(`${API_BASE}/rosters/${id}`, { withCredentials: true })
      .then((res) => {
        this.setState({
          name: res.data?.name || "",
          loading: false
        });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load roster";
        this.setState({ error: msg, loading: false });
      });
     
      api
  .get(`${API_BASE}/students`, { withCredentials: true })
  .then((res) => this.setState({ allStudents: res.data || [] }))
  .catch(() => {});

  };

  addStudent = (id) => {
  this.setState((prev) => {
    const next = new Set(prev.selectedStudentIds);
    next.add(id);
    return { selectedStudentIds: next, query: "" };
  });
};

removeStudent = (id) => {
  this.setState((prev) => {
    const next = new Set(prev.selectedStudentIds);
    next.delete(id);
    return { selectedStudentIds: next };
  });
};


  handleChange = (e) => this.setState({ name: e.target.value });

  handleSubmit = (e) => {
  e.preventDefault();
  const { id } = this.props.params;
  const { name, selectedStudentIds } = this.state;

  this.setState({ saving: true, error: null, success: null });

  // ✅ turn Set -> Array
  const student_ids = Array.from(selectedStudentIds);

  // ✅ include them in the payload
  const payload = {
    roster: {
      name: name.trim(),
      student_ids, // 👈 ADD THIS
    },
  };

  const req = id
    ? api.patch(`${API_BASE}/rosters/${id}`, payload, { withCredentials: true })
    : api.post(`${API_BASE}/rosters`, payload, { withCredentials: true });

  req
    .then((res) => {
      const rosterId = id || res.data?.id;
      this.setState({ saving: false, success: id ? "Roster updated!" : "Roster created!" });

      if (!id && rosterId) {
        this.props.navigate(`/rosters/${rosterId}`);
      }
    })
    .catch((err) => {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to save roster";
      this.setState({ error: msg, saving: false });
    });
};


  render() {
    const { id } = this.props.params;
    const { loading, saving, error, success, name } = this.state;

    if (loading) return <p className="m-4">Loading roster…</p>;

    return (
      <div className="container mt-4" style={{ maxWidth: 760 }}>
        <Card>
          <Card.Body>
            <Card.Title>{id ? "Edit Roster" : "New Roster"}</Card.Title>

            {success && <Alert variant="success" className="mt-3">{success}</Alert>}
            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

            <Form className="mt-3" onSubmit={this.handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Roster name</Form.Label>
                <Form.Control
                  value={name}
                  onChange={this.handleChange}
                  placeholder="e.g., Sat 9am Basic 2"
                  disabled={saving}
                  required
                />
              </Form.Group>

              <div className="d-flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : (id ? "Save changes" : "Create roster")}
                </Button>
                <Button
                  variant="outline-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => this.props.navigate("/rosters")}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </div>
    );
  }
}

export default withRouter(RosterForm);
