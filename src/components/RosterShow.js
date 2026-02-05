import React, { Component } from "react";
import axios from "axios";
import { useParams, useNavigate, Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

function withRouter(Component) {
  return (props) => {
    const params = useParams();
    const navigate = useNavigate();
    return <Component {...props} params={params} navigate={navigate} />;
  };
}

const initialsFor = (p) => {
  if (!p) return "??";
  const first = (p.first_name || p.firstName || "").trim();
  const last = (p.last_name || p.lastName || "").trim();
  const f = first ? first[0] : "";
  const l = last ? last[0] : "";
  const out = `${f}${l}`.toUpperCase();
  return out || "??";
};

const avatarPalette = [
  "#E7F1FF", "#E9F7EF", "#FFF4E5", "#FDECEF",
  "#F3E8FF", "#E6FFFB", "#F1F3F5", "#EAF2FF"
];
const avatarTextPalette = [
  "#1D4ED8", "#047857", "#B45309", "#BE123C",
  "#6D28D9", "#0F766E", "#374151", "#1E40AF"
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function avatarColors(person) {
  const key =
    String(person?.id ?? "") ||
    `${person?.first_name || person?.firstName || ""}-${person?.last_name || person?.lastName || ""}-${person?.email || ""}`;

  const idx = hashString(key) % avatarPalette.length;
  return { bg: avatarPalette[idx], fg: avatarTextPalette[idx] };
}

const AvatarOrPhoto = ({ person, size = 56 }) => {
  const s = Number(size) || 56;
  const src = person?.icon_100_url || person?.photo_url || person?.avatar_url || null;

  if (src) {
    return (
      <img
        alt={`${person?.first_name || ""} ${person?.last_name || ""}`.trim() || "Photo"}
        src={`${src}${src.includes("?") ? "&" : "?"}v=${person?.updated_at || ""}`}
        width={s}
        height={s}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }

  const { bg, fg } = avatarColors(person);

  return (
    <div
      className="border rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
      style={{
        width: s,
        height: s,
        fontWeight: 800,
        background: bg,
        color: fg,
        borderColor: "#e9ecef"
      }}
      aria-hidden="true"
      title={`${person?.first_name || ""} ${person?.last_name || ""}`.trim()}
    >
      {initialsFor(person)}
    </div>
  );
};


const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function compactTime(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    const dt = new Date(2000, 0, 1, hh, mm || 0, 0);
    return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      .replace(":00", "")
      .replace(" AM", "a")
      .replace(" PM", "p")
      .replace(" am", "a")
      .replace(" pm", "p");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(" AM", "a")
    .replace(" PM", "p")
    .replace(" am", "a")
    .replace(" pm", "p");
}

function compactRange(start, end) {
  const s = compactTime(start);
  const e = compactTime(end);
  if (!s && !e) return "";
  if (s && !e) return s;
  if (!s && e) return e;
  return `${s}-${e}`;
}

// Small pill buttons like LessonPlanShow
const pillBtn = {
  className: "rounded-pill px-3",
  style: { fontSize: 12 }
};

// Slightly tighter "icon-chip" style (optional)
const chipBadgeStyle = {
  fontWeight: 600,
  fontSize: 11,
  padding: "6px 10px",
  borderRadius: 999
};

// Same SectionKicker pattern used elsewhere
const SectionKicker = ({ children, className = "", style = {} }) => (
  <div
    className={`text-uppercase text-muted ${className}`}
    style={{ fontSize: 11, letterSpacing: 0.6, ...style }}
  >
    {children}
  </div>
);

function coerceArray(resData) {
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData?.rosters)) return resData.rosters;
  if (Array.isArray(resData?.data)) return resData.data;
  if (Array.isArray(resData?.items)) return resData.items;
  return [];
}


class RosterShow extends Component {
  state = {
    roster: null,
    allStudents: [],
    query: "",
    loading: true,
    saving: false,
    error: null,
    success: null,

    // meetings
    meetingsMatches: [],
    meetingsLoading: false,
    meetingsError: null,

    // weekly schedule
    weeklySchedules: [],
    weeklyLoading: false,
    weeklyError: null,

    // lesson plans matching schedule windows
    lessonPlansInWeek: [],
    lessonPlansLoading: false,
    lessonPlansError: null,
    lessonPlanDeletingOccId: null,


    selectedDate: null,

    // one-off meeting form
    meetingForm: {
      taught_on: "",
      starts_at: "",
      ends_at: "",
      location: ""
    },
    meetingSaving: false,
    meetingError: null,
    meetingSuccess: null,
    meetingDeletingId: null, // ✅ added

    // create weekly schedule form
    newWeekday: "1",
    newStart: "17:00",
    newEnd: "18:00",
    newLocation: "",

    allTeachers: [],
    teacherQuery: "",
    teacherSaving: false,
    teacherError: null,
    teacherSuccess: null,
    showAddTeacher: false,

    isEditingTitle: false,
rosterNameDraft: "",
titleSaving: false,
titleError: null,
weeklyOverview: {}, 
weeklyOverviewLoading: false,
weeklyOverviewError: null,
  };

  componentDidMount() {
     this.loadWeeklyOverview();
    this.loadPage();
  }

  componentDidUpdate(prevProps) {
  const prevId = prevProps.params?.id;
  const nextId = this.props.params?.id;

  if (prevId !== nextId) {
    // optional: reset some state so UI doesn't look stale
    this.setState(
      {
        roster: null,
        loading: true,
        error: null,
        success: null,

        weeklySchedules: [],
        weeklyError: null,
        weeklyLoading: false,

        meetingsMatches: [],
        meetingsError: null,
        meetingsLoading: false,

        lessonPlansInWeek: [],
        lessonPlansError: null,
        lessonPlansLoading: false,
      },
      () => {
        // reload the page data for the new roster id
        this.loadPage();
        // weekly overview can stay global; no need to reload, but harmless if you do
        // this.loadWeeklyOverview();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    );
  }
}


  loadWeeklySchedules = () => {
    const { id } = this.props.params;

    this.setState({ weeklyLoading: true, weeklyError: null });

    axios
      .get(`${API_BASE}/rosters/${id}/roster_schedules`, { withCredentials: true })
      .then((res) => {
        const weeklySchedules = res.data || [];

        this.setState(
          {
            weeklySchedules,
            weeklyLoading: false,
            lessonPlansLoading: true,
            lessonPlansError: null
          },
          () => {
            axios
              .get(`${API_BASE}/rosters/${id}/lesson_plans_matching_schedule?scope=all`, {
                withCredentials: true
              })
              .then((lpRes) =>
                this.setState({
                  lessonPlansInWeek: lpRes.data || [],
                  lessonPlansLoading: false
                })
              )
              .catch((err) => {
                console.error("Failed to load lesson plans matching schedule", err);
                this.setState({
                  lessonPlansInWeek: [],
                  lessonPlansLoading: false,
                  lessonPlansError: err.message || "Failed to load lesson plans"
                });
              });
          }
        );
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load weekly schedules";
        this.setState({ weeklyError: msg, weeklyLoading: false });
      });
  };

  loadPage = () => {
    const { id } = this.props.params;

    this.setState({
      loading: true,
      error: null,
      success: null,
      meetingsError: null
    });

    Promise.all([
      axios.get(`${API_BASE}/rosters/${id}`, { withCredentials: true }),
      axios.get(`${API_BASE}/students/all`, { withCredentials: true }),
      axios.get(`${API_BASE}/users?role=teacher`, { withCredentials: true })
    ])
      .then(([rosterRes, studentsRes, teachersRes]) => {
        const teachersData = teachersRes.data;
        const allTeachers =
          Array.isArray(teachersData)
            ? teachersData
            : Array.isArray(teachersData?.users)
            ? teachersData.users
            : Array.isArray(teachersData?.teachers)
            ? teachersData.teachers
            : [];

        const sd = studentsRes.data;
        const allStudents =
          Array.isArray(sd)
            ? sd
            : Array.isArray(sd?.students)
            ? sd.students
            : Array.isArray(sd?.items)
            ? sd.items
            : Array.isArray(sd?.data)
            ? sd.data
            : [];

        this.setState(
          {
            roster: rosterRes.data,
            rosterNameDraft: rosterRes.data?.name || "", 
            allStudents,
            allTeachers,
            loading: false
          },
          () => {
            this.loadWeeklySchedules();
            this.loadMeetingsMatches();
          }
        );
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load roster";
        this.setState({ error: msg, loading: false });
      });
  };

  loadWeeklyOverview = async () => {
  this.setState({ weeklyOverviewLoading: true, weeklyOverviewError: null });

  try {
    // 1) fetch rosters list (try common endpoints)
    let rostersRes = null;

    try {
      rostersRes = await axios.get(`${API_BASE}/rosters`, { withCredentials: true });
    } catch (e1) {
      rostersRes = await axios.get(`${API_BASE}/rosters/all`, { withCredentials: true });
    }

    const rosters = coerceArray(rostersRes.data);

    // 2) fetch weekly schedules for each roster
    const scheduleRequests = (rosters || [])
      .filter((r) => r?.id != null)
      .map((r) =>
        axios
          .get(`${API_BASE}/rosters/${r.id}/roster_schedules`, { withCredentials: true })
          .then((res) => ({ roster: r, schedules: coerceArray(res.data) }))
          .catch(() => ({ roster: r, schedules: [] }))
      );

    const results = await Promise.all(scheduleRequests);

    // 3) group by weekday
    const grouped = {}; // weekday -> [{ roster, schedule }]

    results.forEach(({ roster, schedules }) => {
      (schedules || []).forEach((sch) => {
        const wd = Number(sch.weekday);
        if (Number.isNaN(wd)) return;
        grouped[wd] = grouped[wd] || [];
        grouped[wd].push({ roster, schedule: sch });
      });
    });

    // 4) sort within weekday by start time then roster name
    Object.keys(grouped).forEach((k) => {
      grouped[k] = grouped[k]
        .slice()
        .sort((a, b) => {
          const at = String(a.schedule?.starts_at || "");
          const bt = String(b.schedule?.starts_at || "");
          if (at !== bt) return at.localeCompare(bt);
          const an = String(a.roster?.name || "").toLowerCase();
          const bn = String(b.roster?.name || "").toLowerCase();
          return an.localeCompare(bn);
        });
    });

    this.setState({ weeklyOverview: grouped, weeklyOverviewLoading: false });
  } catch (err) {
    const msg =
      err.response?.data?.errors?.join(", ") ||
      err.response?.data?.error ||
      err.message ||
      "Failed to load weekly overview";
    this.setState({ weeklyOverviewError: msg, weeklyOverviewLoading: false });
  }
};


  addStudent = (studentId) => {
    const { id } = this.props.params;
    if (!studentId) return;

    this.setState({ saving: true, error: null, success: null });

    axios
      .post(`${API_BASE}/rosters/${id}/add_student/${studentId}`, null, {
        withCredentials: true
      })
      .then((res) => {
        this.setState({
          roster: res.data,
          saving: false,
          success: "Student added!",
          query: ""
        });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to add student";
        this.setState({ error: msg, saving: false });
      });
  };

  removeStudent = (studentId) => {
    const { id } = this.props.params;
    this.setState({ saving: true, error: null, success: null });

    axios
      .delete(`${API_BASE}/rosters/${id}/remove_student/${studentId}`, {
        withCredentials: true
      })
      .then((res) => {
        this.setState({ roster: res.data, saving: false, success: "Student removed." });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to remove student";
        this.setState({ error: msg, saving: false });
      });
  };

  addTeacher = (teacherId) => {
    const { id } = this.props.params;
    if (!teacherId) return;

    this.setState({ teacherSaving: true, teacherError: null, teacherSuccess: null });

    axios
      .post(`${API_BASE}/rosters/${id}/add_teacher/${teacherId}`, null, {
        withCredentials: true
      })
      .then((res) => {
        this.setState((prev) => ({
          roster: { ...prev.roster, ...res.data },
          teacherSaving: false,
          teacherSuccess: "Teacher added!",
          teacherQuery: ""
        }));
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to add teacher";
        this.setState({ teacherError: msg, teacherSaving: false });
      });
  };

  removeTeacher = (teacherId) => {
    const { id } = this.props.params;

    this.setState({ teacherSaving: true, teacherError: null, teacherSuccess: null });

    axios
      .delete(`${API_BASE}/rosters/${id}/remove_teacher/${teacherId}`, {
        withCredentials: true
      })
      .then((res) => {
        this.setState((prev) => ({
          roster: { ...prev.roster, ...res.data },
          teacherSaving: false,
          teacherSuccess: "Teacher removed."
        }));
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to remove teacher";
        this.setState({ teacherError: msg, teacherSaving: false });
      });
  };

  removeLessonPlanFromRoster = (occ) => {
  const rosterId = this.props.params.id;
  const lpId = occ?.lesson_plan?.id || occ?.lesson_plan_id;
  const occId = occ?.id;
  if (!lpId || !occId) return;

  if (!window.confirm("Remove this lesson plan from this roster schedule?")) return;

  this.setState({ lessonPlanDeletingOccId: occId, lessonPlansError: null, success: null });

  axios
    .delete(`${API_BASE}/lesson_plans/${lpId}/lesson_plan_occurrences/${occId}`, {
      withCredentials: true
    })
    .then(() => {
      this.setState({ lessonPlanDeletingOccId: null, success: "Lesson plan removed from roster schedule." });

      // refresh both sources
      this.loadWeeklySchedules();
      this.loadMeetingsMatches();
    })
    .catch((err) => {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to remove lesson plan occurrence";
      this.setState({ lessonPlanDeletingOccId: null, lessonPlansError: msg });
    });
};

  handleMeetingField = (e) => {
    const { name, value } = e.target;
    this.setState((prev) => ({
      meetingForm: { ...prev.meetingForm, [name]: value }
    }));
  };

  submitMeeting = (e) => {
    e.preventDefault();
    const { id } = this.props.params;
    const { taught_on, starts_at, ends_at, location } = this.state.meetingForm;

    if (!taught_on || !starts_at || !ends_at) {
      return this.setState({ meetingError: "Date, start time, and end time are required." });
    }

    this.setState({ meetingSaving: true, meetingError: null, meetingSuccess: null });

    axios
      .post(
        `${API_BASE}/rosters/${id}/roster_meetings`,
        {
          roster_meeting: {
            taught_on,
            starts_at,
            ends_at,
            location: (location || "").trim()
          }
        },
        { withCredentials: true }
      )
      .then(() => {
        this.setState({
          meetingSaving: false,
          meetingSuccess: "Meeting added!",
          meetingForm: { taught_on: "", starts_at: "", ends_at: "", location: "" }
        });

        this.loadMeetingsMatches();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create meeting";
        this.setState({ meetingError: msg, meetingSaving: false });
      });
  };

  // ✅ NEW: delete one-off meeting
  deleteOneOffMeeting = (meetingId) => {
    const { id } = this.props.params;
    if (!meetingId) return;

    if (!window.confirm("Remove this one-off meeting?")) return;

    this.setState({ meetingDeletingId: meetingId, meetingError: null, meetingSuccess: null });

    axios
      .delete(`${API_BASE}/rosters/${id}/roster_meetings/${meetingId}`, {
        withCredentials: true
      })
      .then(() => {
        this.setState({ meetingDeletingId: null, meetingSuccess: "Meeting removed." });
        this.loadMeetingsMatches();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to remove meeting";
        this.setState({ meetingDeletingId: null, meetingError: msg });
      });
  };

  createWeeklySchedule = (e) => {
    e.preventDefault();
    const { id } = this.props.params;

    const payload = {
      roster_schedule: {
        weekday: Number(this.state.newWeekday),
        starts_at: this.state.newStart,
        ends_at: this.state.newEnd,
        location: this.state.newLocation
      }
    };

    this.setState({ saving: true, weeklyError: null });

    axios
      .post(`${API_BASE}/rosters/${id}/roster_schedules`, payload, { withCredentials: true })
      .then(() => {
        this.setState({
          saving: false,
          newLocation: "",
          success: "Weekly time added!"
        });
        this.loadWeeklySchedules();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create weekly schedule";
        this.setState({ weeklyError: msg, saving: false });
      });
  };

  deleteWeeklySchedule = (scheduleId) => {
    const { id } = this.props.params;
    if (!window.confirm("Remove from schedule?")) return;

    this.setState({ saving: true, weeklyError: null });

    axios
      .delete(`${API_BASE}/rosters/${id}/roster_schedules/${scheduleId}`, {
        withCredentials: true
      })
      .then(() => {
        this.setState({ saving: false, success: "Weekly time removed." });
        this.loadWeeklySchedules();
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to remove weekly schedule";
        this.setState({ weeklyError: msg, saving: false });
      });
  };

  deleteRoster = () => {
    const { id } = this.props.params;
    if (!window.confirm("Delete this roster? This cannot be undone.")) return;

    this.setState({ saving: true, error: null, success: null });

    axios
      .delete(`${API_BASE}/rosters/${id}`, { withCredentials: true })
      .then(() => this.props.navigate("/rosters"))
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to delete roster";
        this.setState({ error: msg, saving: false });
      });
  };

  loadMeetingsMatches = () => {
    const { id } = this.props.params;

    this.setState({ meetingsLoading: true, meetingsError: null });

    axios
      .get(`${API_BASE}/rosters/${id}/scheduled_lessons`, { withCredentials: true })
      .then((res) => {
        this.setState({ meetingsMatches: res.data?.matches || [], meetingsLoading: false });
      })
      .catch((err) => {
        const msg =
          err.response?.data?.errors?.join(", ") ||
          err.response?.data?.error ||
          err.message ||
          "Failed to load meeting lesson matches";
        this.setState({ meetingsError: msg, meetingsLoading: false });
      });
  };

  fmtTimeAny = (value) => {
    if (!value) return "";

    if (typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      const [hh, mm, ss] = value.split(":").map(Number);
      const dt = new Date(2000, 0, 1, hh, mm || 0, ss || 0, 0);
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(dt);
    }

    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    const looksLikeTimeOnlyISO =
      typeof value === "string" &&
      (/^2000-01-01T/.test(value) || /^1970-01-01T/.test(value) || value.endsWith("Z"));

    if (looksLikeTimeOnlyISO) {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC"
      }).format(d);
    }

    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
  };

  fmtTimeRangeAny = (start, end) => {
    const s = this.fmtTimeAny(start);
    const e = this.fmtTimeAny(end);
    if (!s && !e) return "";
    if (s && !e) return s;
    if (!s && e) return e;
    return `${s} – ${e}`;
  };

  fmtDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return "";
    const [y, m, d] = String(yyyyMmDd).split("-").map(Number);
    if (!y || !m || !d) return String(yyyyMmDd);
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(dt);
  };

  normalizeStudentList = (arr) =>
    (arr || [])
      .slice()
      .sort((a, b) => {
        const an = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
        const bn = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
        return an.localeCompare(bn);
      });

      startEditTitle = () => {
  const current = this.state.roster?.name || "";
  this.setState({
    isEditingTitle: true,
    rosterNameDraft: this.state.rosterNameDraft || current,
    titleError: null,
    success: null,
    error: null
  });
};

cancelEditTitle = () => {
  this.setState({
    isEditingTitle: false,
    rosterNameDraft: this.state.roster?.name || "",
    titleError: null
  });
};

saveTitle = () => {
  const { id } = this.props.params;
  const name = (this.state.rosterNameDraft || "").trim();
  if (!name) return this.setState({ titleError: "Roster name can’t be blank." });

  this.setState({ titleSaving: true, titleError: null, success: null, error: null });

  axios
    .patch(
      `${API_BASE}/rosters/${id}`,
      { roster: { name } },
      { withCredentials: true }
    )
    .then((res) => {
      const updated = res.data?.roster ?? res.data;
      this.setState((prev) => ({
        roster: { ...prev.roster, ...updated },
        isEditingTitle: false,
        titleSaving: false,
        success: "Roster title updated!"
      }));
    })
    .catch((err) => {
      const msg =
        err.response?.data?.errors?.join(", ") ||
        err.response?.data?.error ||
        err.message ||
        "Failed to update roster title";
      this.setState({ titleSaving: false, titleError: msg });
    });
};


  render() {
    const { id } = this.props.params;
    const { roster, allStudents, loading, saving, error, success } = this.state;

    if (loading) return <p className="m-4">Loading roster…</p>;
    if (!roster) return <Alert variant="danger" className="m-4">Roster not found.</Alert>;

    const rosterStudentIds = new Set((roster.students || []).map((s) => String(s.id)));
    const availableStudents = (allStudents || []).filter((s) => !rosterStudentIds.has(String(s.id)));

    // teachers
    const owner = roster.teacher || null;
    const ownerId = owner?.id ? String(owner.id) : null;

    const extras = Array.isArray(roster.teachers) ? roster.teachers : [];
    const teachers = [owner, ...extras]
      .filter(Boolean)
      .reduce((acc, t) => {
        if (!t?.id) return acc;
        const tid = String(t.id);
        if (!acc.some((x) => String(x.id) === tid)) acc.push(t);
        return acc;
      }, []);

    const teacherIds = new Set(teachers.map((t) => String(t.id)));
    const availableTeachers = (this.state.allTeachers || []).filter((u) => !teacherIds.has(String(u.id)));

    const tq = (this.state.teacherQuery || "").toLowerCase().trim();
    const teacherMatches = tq
      ? availableTeachers.filter((u) => {
          const first = (u.first_name || u.firstName || "").toLowerCase();
          const last = (u.last_name || u.lastName || "").toLowerCase();
          const name = `${first} ${last}`.trim();
          const email = (u.email || "").toLowerCase();
          const alt = (u.name || "").toLowerCase();
          return name.includes(tq) || email.includes(tq) || alt.includes(tq);
        })
      : [];

    // combined lesson plan occurrences
    const weeklyOccs = this.state.lessonPlansInWeek || [];
    const meetingOccs = (this.state.meetingsMatches || []).flatMap((row) => {
      const meeting = row.meeting || {};
      return (row.occurrences || []).map((occ) => ({
        ...occ,
        taught_on: occ.taught_on || meeting.taught_on,
        starts_at: occ.starts_at || meeting.starts_at,
        ends_at: occ.ends_at || meeting.ends_at,
        location: occ.location || meeting.location,
        __source: "meeting"
      }));
    });

    const occById = new Map();
    [...weeklyOccs, ...meetingOccs].forEach((occ) => {
      if (occ && occ.id != null) occById.set(occ.id, occ);
    });

    const allOccs = Array.from(occById.values()).sort((a, b) => {
      const ad = (a.taught_on || "").localeCompare(b.taught_on || "");
      if (ad !== 0) return ad;
      return String(a.starts_at || "").localeCompare(String(b.starts_at || ""));
    });

    // combined add student results
    const sq = (this.state.query || "").toLowerCase().trim();
    const addMatches = sq
      ? availableStudents
          .filter((s) => {
            const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
            const email = (s.email || "").toLowerCase();
            return name.includes(sq) || email.includes(sq);
          })
          .slice(0, 20)
      : [];

    const totalStudents = roster.students?.length || 0;
    const weeklyCount = Array.isArray(this.state.weeklySchedules) ? this.state.weeklySchedules.length : 0;
    const meetingCount = Array.isArray(this.state.meetingsMatches) ? this.state.meetingsMatches.length : 0;

    // ✅ sort one-offs by date then start time (so it reads nicely)
    const sortedMeetings = (this.state.meetingsMatches || [])
      .slice()
      .sort((a, b) => {
        const am = a?.meeting || {};
        const bm = b?.meeting || {};
        const d = String(am.taught_on || "").localeCompare(String(bm.taught_on || ""));
        if (d !== 0) return d;
        return String(am.starts_at || "").localeCompare(String(bm.starts_at || ""));
      });

    return (
      <div className="container mt-4" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-start gap-3 mb-3">
  <div style={{ flex: 1, minWidth: 260 }}>
    {!this.state.isEditingTitle ? (
      <>
        <h1 className="mb-1" style={{ wordBreak: "break-word" }}>{roster.name}</h1>
      </>
    ) : (
      <>
        <Form.Group className="mb-2">
          <Form.Label className="text-muted" style={{ fontSize: 12 }}>
            Roster title
          </Form.Label>
          <Form.Control
            value={this.state.rosterNameDraft}
            onChange={(e) => this.setState({ rosterNameDraft: e.target.value })}
            disabled={this.state.titleSaving}
            style={{ borderRadius: 12 }}
          />
        </Form.Group>

        {this.state.titleError && (
          <Alert variant="danger" className="py-2 mb-2">
            {this.state.titleError}
          </Alert>
        )}

        <div className="text-muted" style={{ fontSize: 12 }}>
          Rename this roster without leaving the page.
        </div>
      </>
    )}
  </div>

  <div className="d-flex flex-column flex-sm-row gap-2">
  {!this.state.isEditingTitle ? (
    <Button
      size="sm"
      variant="primary"
      onClick={this.startEditTitle}
      {...pillBtn}
    >
      Edit title
    </Button>
  ) : (
    <>
      <Button
        size="sm"
        variant="primary"
        onClick={this.saveTitle}
        disabled={this.state.titleSaving}
        {...pillBtn}
      >
        {this.state.titleSaving ? "Saving..." : "Save"}
      </Button>

      <Button
        size="sm"
        variant="outline-secondary"
        onClick={this.cancelEditTitle}
        disabled={this.state.titleSaving}
        {...pillBtn}
      >
        Cancel
      </Button>
    </>
  )}

  <Button
    size="sm"
    variant="outline-danger"
    onClick={this.deleteRoster}
    disabled={saving || this.state.titleSaving}
    {...pillBtn}
  >
    Delete
  </Button>
</div>
</div>


        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Row className="g-3">
          {/* Students (combined add + list) */}
          <Col md={7}>
            <Card style={{ borderRadius: 14 }} className="h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <Card.Title className="mb-0">Students</Card.Title>
                  <Badge bg="secondary">{totalStudents}</Badge>
                </div>

                <div className="mt-3">
                  <Form.Control
                    type="text"
                    placeholder="Search to add a student…"
                    value={this.state.query}
                    onChange={(e) => this.setState({ query: e.target.value })}
                    style={{ borderRadius: 12 }}
                  />

                  {sq && (
                    <div
                      className="border rounded-3 mt-2"
                      style={{ maxHeight: 240, overflowY: "auto", background: "#fff" }}
                    >
                      {addMatches.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-100 text-start btn btn-light border-0 rounded-0"
                          onClick={() => this.addStudent(s.id)}
                          disabled={saving}
                          style={{ padding: "10px 12px" }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <AvatarOrPhoto person={s} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <div className="fw-semibold" style={{ lineHeight: 1.1 }}>
                                {s.first_name} {s.last_name}
                              </div>
                              <div className="text-muted" style={{ fontSize: 12, wordBreak: "break-word" }}>
                                {s.email || "No email"}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                      {addMatches.length === 0 && <div className="p-2 text-muted">No matches.</div>}
                    </div>
                  )}

                  <div className="form-text mt-1">Type a name or email, then click a result to add.</div>
                </div>

                {(!roster.students || roster.students.length === 0) ? (
                  <p className="text-muted mb-0 mt-3">No students in this roster yet.</p>
                ) : (
                  <div className="d-grid mt-3" style={{ gap: 10 }}>
                    {this.normalizeStudentList(roster.students).map((s) => (
                      <div
                        key={s.id}
                        className="border rounded-3 p-2 d-flex flex-column flex-md-row align-items-stretch align-items-md-center"
                        style={{ gap: 10 }}
                      >
                        <div className="d-flex align-items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                          <AvatarOrPhoto person={s} size={44} />
                          <div style={{ minWidth: 0 }}>
                            <div className="fw-semibold" style={{ fontSize: 15, lineHeight: 1.2 }}>
                              {s.first_name} {s.last_name}
                            </div>
                            {s.email ? (
                              <div className="text-muted" style={{ fontSize: 12, wordBreak: "break-word" }}>
                                {s.email}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="d-flex gap-2 justify-content-end"> 
                          <Link to={`/students/${s.id}`} className="btn btn-outline-primary rounded-pill px-3" style={{ fontSize: 12, minWidth: 84,}}>
                            View
                          </Link>

                          <Button
                                variant="outline-danger"
    className="btn btn-outline-primary btn-sm rounded-pill px-3"
                            disabled={saving}
                            onClick={() => this.removeStudent(s.id)}
                            style={{ fontSize: 12, minWidth: 84,}}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Teachers */}
          <Col md={5}>
            <Card className="mb-3" style={{ borderRadius: 14 }}>
              <Card.Body>
                <Card.Title className="d-flex justify-content-between align-items-center mb-3">
                  <span>Instructor(s)</span>
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="secondary">{teachers.length}</Badge>
                    <Button
                      size="sm"
    className="btn btn-outline-primary btn-sm rounded-pill px-3"
    style={{ fontSize: 12, minWidth: 84,}}
                      variant="outline-primary"
                      onClick={() =>
                        this.setState((p) => ({
                          showAddTeacher: !p.showAddTeacher,
                          teacherError: null,
                          teacherSuccess: null
                        }))
                      }
                    >
                      {this.state.showAddTeacher ? "Done" : "Add"}
                    </Button>
                  </div>
                </Card.Title>

                {this.state.teacherSuccess && <Alert variant="success">{this.state.teacherSuccess}</Alert>}
                {this.state.teacherError && <Alert variant="danger">{this.state.teacherError}</Alert>}

                {this.state.showAddTeacher && (
                  <Form.Group className="mb-3">
                    <Form.Control
                      type="text"
                      placeholder="Search teachers…"
                      value={this.state.teacherQuery}
                      onChange={(e) => this.setState({ teacherQuery: e.target.value })}
                      disabled={this.state.teacherSaving}
                      style={{ borderRadius: 12 }}
                    />

                    {tq && (
                      <div className="border rounded-3 mt-2" style={{ maxHeight: 220, overflowY: "auto" }}>
                        {teacherMatches.slice(0, 20).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            style={{ fontSize: 12, minWidth: 84,}}
                            className="w-100 text-start btn btn-light border-0 rounded-0"
                            onClick={() => this.addTeacher(t.id)}
                            disabled={this.state.teacherSaving}
                          >
                            <div className="fw-semibold">
                              {(t.first_name || t.firstName || "")} {(t.last_name || t.lastName || "")}
                            </div>
                            <div className="text-muted" style={{ fontSize: 12 }}>
                              {t.email}
                            </div>
                          </button>
                        ))}
                        {teacherMatches.length === 0 && <div className="p-2 text-muted">No matches.</div>}
                      </div>
                    )}

                    <div className="form-text">Type to search, click a teacher to add.</div>
                  </Form.Group>
                )}

                {teachers.length === 0 ? (
                  <div className="text-muted">No teachers assigned.</div>
                ) : (
                  <div className="d-grid" style={{ gap: 10 }}>
                    {teachers.map((t) => {
                      const isOwner = ownerId && String(t.id) === String(ownerId);
                      const canRemoveThisTeacher = !isOwner && teachers.length > 1;

                      return (
                        <div
                          key={t.id || `${t.email}-${t.first_name}`}
                          className="border rounded-3 p-2 d-flex align-items-center gap-3"
                        >
                          <AvatarOrPhoto person={t} size={44} />
                          <div className="flex-grow-1">
                            <div className="fw-semibold">
                              {(t.first_name || "")} {(t.last_name || "")}
                            </div>
                            <div className="text-muted" style={{ fontSize: 13 }}>
                              {t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : "No email"}
                            </div>
                          </div>

                          {canRemoveThisTeacher ? (
                            <Button
                            size="sm"
                                  variant="outline-danger"
    className="btn btn-outline-primary btn-sm rounded-pill px-3"
    style={{ fontSize: 12, minWidth: 84,}}
                              disabled={this.state.teacherSaving}
                              onClick={() => this.removeTeacher(t.id)}
                            >
                              Remove
                            </Button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 12 }}>
                              {isOwner ? <Badge bg="light" text="dark">Owner</Badge> : null}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* ✅ Combined Schedule card (Weekly + One-Off Meetings) */}
        <Card className="mt-3" style={{ borderRadius: 14 }}>
          <Card.Body>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
  <Card.Title className="mb-0">Schedule</Card.Title>

  <div className="d-flex align-items-center gap-2">
    <Badge bg="secondary">{weeklyCount + sortedMeetings.length}</Badge>
    <span className="text-muted" style={{ fontSize: 13 }}></span>
  </div>
</div>
{/* GLOBAL WEEKLY OVERVIEW GRID (all rosters) */}
<div className="mt-3">
  <div className="d-flex align-items-center gap-2 mb-2">
    <SectionKicker>My weekly schedule</SectionKicker>
    <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
  </div>

  {this.state.weeklyOverviewError ? (
    <Alert variant="danger" className="mb-2">
      {this.state.weeklyOverviewError}
    </Alert>
  ) : null}

  {this.state.weeklyOverviewLoading ? (
    <div className="text-muted" style={{ fontSize: 13 }}>
      Loading weekly schedule…
    </div>
  ) : (
    <Row className="g-2">
      {Array.from({ length: 7 }).map((_, wd) => {
        const rows = (this.state.weeklyOverview || {})[wd] || [];

        return (
          <Col key={wd} xs={12} sm={6} md={3} lg>
            <div className="border rounded-3 p-2 h-100" style={{ background: "#fff" }}>
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-uppercase text-muted" style={{ fontSize: 10, letterSpacing: 0.6 }}>
                  {dayShort[wd]}
                </div>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {rows.length ? rows.length : ""}
                </span>
              </div>

              {rows.length === 0 ? (
                <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                  —
                </div>
              ) : (
                <div className="mt-2 d-flex flex-column" style={{ gap: 6 }}>
                  {rows.slice(0, 6).map(({ roster: r, schedule }) => {
                    const t = compactRange(schedule?.starts_at, schedule?.ends_at);
                    return (
                      <div
                        key={`${r?.id}-${schedule?.id}`}
                        className="d-flex align-items-start justify-content-between"
                        style={{ gap: 8 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <Link
                            to={`/rosters/${r?.id}`}
                            className="text-decoration-none fw-semibold"
                            style={{
                              fontSize: 12,
                              lineHeight: 1.15,
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                            title={r?.name || ""}
                          >
                            {r?.name || "Roster"}
                          </Link>

                          <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.15 }}>
                            {t || "time"}
                            {schedule?.location ? ` • ${schedule.location}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {rows.length > 6 ? (
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      +{rows.length - 6} more
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </Col>
        );
      })}
    </Row>
  )}
</div>

<hr className="my-3" />


<hr className="my-3" />

<div className="mt-3 d-flex align-items-center gap-2">
  <SectionKicker>Weekly & one-offs</SectionKicker>
  <div className="flex-grow-1" style={{ height: 1, background: "#e9ecef" }} />
</div>


            <Row className="g-3 mt-1">
              {/* LEFT: lists */}
              <Col md={7}>
                {/* Weekly list */}
                <div className="border rounded-3 p-3 mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">Weekly Timeslots</div>
                    <Badge bg="light" text="dark">{weeklyCount}</Badge>
                  </div>

                  {this.state.weeklyError && <Alert variant="danger" className="mt-2 mb-0">{this.state.weeklyError}</Alert>}
                  {this.state.weeklyLoading && <p className="text-muted mb-0 mt-2">Loading…</p>}

                  {!this.state.weeklyLoading && weeklyCount === 0 && (
                    <p className="text-muted mb-0 mt-2">No weekly times yet.</p>
                  )}

                  {!this.state.weeklyLoading && weeklyCount > 0 && (
                    <div className="mt-2 d-grid" style={{ gap: 8 }}>
                      {this.state.weeklySchedules
                        .slice()
                        .sort((a, b) => {
                          const aw = Number(a.weekday);
                          const bw = Number(b.weekday);
                          if (aw !== bw) return aw - bw;
                          return String(a.starts_at || "").localeCompare(String(b.starts_at || ""));
                        })
                        .map((w) => (
                         <div
  key={w.id}
  className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-center"
  style={{
    gap: 12,
    background: "#fbfbfd",
    borderColor: "#e9ecef",
  }}
>
  <div style={{ minWidth: 0 }}>
    <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
      <span className="fw-semibold" style={{ fontSize: 13 }}>
        {dayNames[w.weekday]}
      </span>

      <span className="text-muted" style={{ fontSize: 12 }}>
        {this.fmtTimeRangeAny(w.starts_at, w.ends_at)}
      </span>

      {w.location ? (
        <Badge bg="light" text="dark" className="border" style={chipBadgeStyle}>
          {w.location}
        </Badge>
      ) : null}
    </div>
  </div>

  <Button
    size="sm"
    className="btn btn-sm rounded-pill px-3"
  style={{ fontSize: 12, minWidth: 84 }}
    variant="outline-danger"
    disabled={this.state.saving}
    onClick={() => this.deleteWeeklySchedule(w.id)}
    {...pillBtn}
  >
    Remove
  </Button>
</div>

                        ))}
                    </div>
                  )}
                </div>

                {/* ✅ One-off meeting list (NOW looks like weekly rows + has Remove) */}
                <div className="border rounded-3 p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">One-off Classes/Meetings</div>
                    <Badge bg="light" text="dark">{meetingCount}</Badge>
                  </div>

                  {/* show any add/delete messages here (so it feels tied to list) */}
                  {this.state.meetingSuccess && <Alert variant="success" className="mt-2 mb-0">{this.state.meetingSuccess}</Alert>}
                  {this.state.meetingError && <Alert variant="danger" className="mt-2 mb-0">{this.state.meetingError}</Alert>}

                  {this.state.meetingsError && <Alert variant="danger" className="mt-2 mb-0">{this.state.meetingsError}</Alert>}
                  {this.state.meetingsLoading && <p className="text-muted mb-0 mt-2">Loading…</p>}

                  {!this.state.meetingsLoading && sortedMeetings.length === 0 && (
                    <p className="text-muted mb-0 mt-2">No one-off meetings scheduled yet.</p>
                  )}

                  {!this.state.meetingsLoading && sortedMeetings.length > 0 && (
                    <div className="mt-2 d-grid" style={{ gap: 8 }}>
                      {sortedMeetings.map((row) => {
                        const meeting = row?.meeting || {};
                        const meetingId = meeting?.id;

                        return (
                          <div
  key={meetingId || `${meeting.taught_on || "no-date"}-${meeting.starts_at || "no-start"}`}
  className="border rounded-3 px-3 py-2 d-flex justify-content-between align-items-center"
  style={{
    gap: 12,
    background: "#fbfbfd",
    borderColor: "#e9ecef",
  }}
>
  <div style={{ minWidth: 0 }}>
    <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
      <Link
  to={`/calendar?date=${encodeURIComponent(meeting.taught_on || "")}`}
  className="text-decoration-none fw-semibold"
  style={{ fontSize: 13 }}
>
  {this.fmtDate(meeting.taught_on)}
</Link>


      {(meeting.starts_at || meeting.ends_at) ? (
        <span className="text-muted" style={{ fontSize: 12 }}>
          {this.fmtTimeRangeAny(meeting.starts_at, meeting.ends_at)}
        </span>
      ) : null}

      {meeting.location ? (
        <Badge bg="light" text="dark" className="border" style={chipBadgeStyle}>
          {meeting.location}
        </Badge>
      ) : null}
    </div>
  </div>

  <Button
    size="sm"
    variant="outline-danger"
    disabled={!meetingId || this.state.meetingDeletingId === meetingId}
    onClick={() => this.deleteOneOffMeeting(meetingId)}
    {...pillBtn}
  >
    {this.state.meetingDeletingId === meetingId ? "Removing…" : "Remove"}
  </Button>
</div>

                        );
                      })}
                    </div>
                  )}
                </div>
              </Col>

              {/* RIGHT: forms */}
              <Col md={5}>
                {/* Add weekly time */}
                <div className="border rounded-3 p-3 mb-3">
                  <div className="fw-semibold mb-2">Add weekly time</div>

                  <Form onSubmit={this.createWeeklySchedule}>
                    <Row className="g-2">
                      <Col md={12}>
                        <Form.Label>Day</Form.Label>
                        <Form.Select
                          value={this.state.newWeekday}
                          onChange={(e) => this.setState({ newWeekday: e.target.value })}
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </Form.Select>
                      </Col>

                      <Col xs={6}>
                        <Form.Label>Start</Form.Label>
                        <Form.Control
                          type="time"
                          value={this.state.newStart}
                          onChange={(e) => this.setState({ newStart: e.target.value })}
                          required
                        />
                      </Col>

                      <Col xs={6}>
                        <Form.Label>End</Form.Label>
                        <Form.Control
                          type="time"
                          value={this.state.newEnd}
                          onChange={(e) => this.setState({ newEnd: e.target.value })}
                          required
                        />
                      </Col>

                      <Col md={12}>
                        <Form.Label>Location (optional)</Form.Label>
                        <Form.Control
                          value={this.state.newLocation}
                          onChange={(e) => this.setState({ newLocation: e.target.value })}
                          placeholder="e.g., Rink A"
                        />
                      </Col>

                      <Col md={12} className="mt-2">
                        <Button type="submit" className="btn btn-sm rounded-pill px-3"
  style={{ fontSize: 12, minWidth: 84 }} disabled={this.state.saving}>
                          Add weekly time
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </div>

                {/* Add one-off meeting */}
                <div className="border rounded-3 p-3">
                  <div className="fw-semibold mb-2">Add one-off meeting</div>

                  <Form onSubmit={this.submitMeeting}>
                    <Row className="g-2">
                      <Col md={12}>
                        <Form.Label className="text-muted" style={{ fontSize: 12 }}>Date</Form.Label>
                        <Form.Control
                          type="date"
                          name="taught_on"
                          value={this.state.meetingForm.taught_on}
                          onChange={this.handleMeetingField}
                          disabled={this.state.meetingSaving}
                          required
                        />
                      </Col>

                      <Col xs={6}>
                        <Form.Label className="text-muted" style={{ fontSize: 12 }}>Start</Form.Label>
                        <Form.Control
                          type="time"
                          name="starts_at"
                          value={this.state.meetingForm.starts_at}
                          onChange={this.handleMeetingField}
                          disabled={this.state.meetingSaving}
                          required
                        />
                      </Col>

                      <Col xs={6}>
                        <Form.Label className="text-muted" style={{ fontSize: 12 }}>End</Form.Label>
                        <Form.Control
                          type="time"
                          name="ends_at"
                          value={this.state.meetingForm.ends_at}
                          onChange={this.handleMeetingField}
                          disabled={this.state.meetingSaving}
                          required
                        />
                      </Col>

                      <Col md={12}>
                        <Form.Label className="text-muted" style={{ fontSize: 12 }}>Location (optional)</Form.Label>
                        <Form.Control
                          type="text"
                          name="location"
                          placeholder="e.g., Rink A"
                          value={this.state.meetingForm.location}
                          onChange={this.handleMeetingField}
                          disabled={this.state.meetingSaving}
                        />
                      </Col>

                      <Col md={12} className="mt-2">
                        <Button type="submit" className="btn btn-sm rounded-pill px-3"
  style={{ fontSize: 12, minWidth: 84 }} disabled={this.state.meetingSaving}>
                          {this.state.meetingSaving ? "Adding…" : "Add one-off meeting"}
                        </Button>
                      </Col>
                    </Row>
                  </Form>

                  <div className="form-text mt-2">
                    One-off meetings are specific dates (not weekly repeating).
                  </div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Lesson Plans */}
        <Card className="mt-3" style={{ borderRadius: 14 }}>
          <Card.Body>
            <Card.Title className="d-flex justify-content-between align-items-center">
              <span>Lesson Plans</span>
              <Badge bg="secondary">{allOccs.length}</Badge>
            </Card.Title>

            {this.state.lessonPlansError && <Alert variant="danger">{this.state.lessonPlansError}</Alert>}
            {this.state.lessonPlansLoading && <p className="text-muted mb-0">Loading…</p>}

            {!this.state.lessonPlansLoading && allOccs.length === 0 && (
              <p className="text-muted mb-0">
                No lesson plans scheduled during this roster’s weekly meeting times (or one-off meetings).
              </p>
            )}

            {!this.state.lessonPlansLoading && allOccs.length > 0 && (
              <div className="d-grid" style={{ gap: 10 }}>
                {allOccs.map((occ) => (
                  <div
  key={occ.id}
  className="border rounded-3 p-2 d-flex justify-content-between align-items-start"
  style={{ gap: 10 }}
>
  <div style={{ minWidth: 0 }}>
    <div className="fw-semibold" style={{ wordBreak: "break-word" }}>
      <Link to={`/lesson-plans/${occ?.lesson_plan?.id || occ?.lesson_plan_id}?roster_id=${id}`}>
        {occ?.lesson_plan?.title || "Lesson Plan"}
      </Link>

      {occ.__source === "meeting" ? (
        <Badge bg="light" text="dark" className="ms-2">one-off</Badge>
      ) : (
        <Badge bg="light" text="dark" className="ms-2">weekly</Badge>
      )}
    </div>

    <div className="text-muted" style={{ fontSize: 13, wordBreak: "break-word" }}>
      {this.fmtDate(occ.taught_on)}
      {` • ${this.fmtTimeRangeAny(occ.starts_at, occ.ends_at)}`}
      {occ.location ? ` • ${occ.location}` : ""}
    </div>
  </div>

  <Button
    size="sm"
    variant="outline-danger"
    className="btn btn-outline-primary btn-sm rounded-pill px-3"
  style={{ fontSize: 12, minWidth: 84,}}
    disabled={this.state.lessonPlanDeletingOccId === occ.id}
    onClick={() => this.removeLessonPlanFromRoster(occ)}
  >
    {this.state.lessonPlanDeletingOccId === occ.id ? "Removing…" : "Remove"}
  </Button>
</div>

                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    );
  }
}

export default withRouter(RosterShow);
