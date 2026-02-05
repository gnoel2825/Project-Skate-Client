import React, { useState } from "react";
import axios from "axios";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

import {
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
  CNavItem,
  CNavTitle,
  CNavLink,
} from "@coreui/react";

import CIcon from "@coreui/icons-react";
import {
  cilCalendar,
  cilAddressBook,
  cilLayers,
  cilPencil,
  cilSettings,
  cilPeople,
  cilAccountLogout,
} from "@coreui/icons";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: cilCalendar, end: true },
  { to: "/students", label: "Students", icon: cilAddressBook },
  { to: "/rosters", label: "Rosters", icon: cilLayers },
  { to: "/lesson-plans", label: "Lesson Plans", icon: cilPencil },
  { to: "/settings", label: "Settings", icon: cilSettings },
];

const isPathActive = (pathname, to, end) => {
  if (end) return pathname === to;
  // exact match OR nested route match, but not "/studentsX"
  return pathname === to || pathname.startsWith(`${to}/`);
};

const NavItemLink = ({ to, icon, label, onClick, iconsOnly = false, end = false }) => {
  const { pathname } = useLocation();
  const active = isPathActive(pathname, to, end);

  return (
    <CNavItem>
      <CNavLink
        as={NavLink}
        to={to}
        onClick={onClick}
        active={active} // ✅ lets CoreUI know too
        className={`glisse-navlink ${active ? "is-active" : ""}`}
      >
        <CIcon customClassName="nav-icon" icon={icon} />
        {!iconsOnly ? <span className="glisse-navtext">{label}</span> : null}
      </CNavLink>
    </CNavItem>
  );
};

export const Navi = ({ handleLogout, currentUser }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogoutClick = async (e) => {
    e?.preventDefault?.();
    try {
      await axios.delete(`${API_BASE}/logout`, { withCredentials: true });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      handleLogout?.();
      setMobileOpen(false);
      navigate("/", { replace: true });
    }
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="d-md-none border-bottom bg-body position-sticky top-0" style={{ zIndex: 1030 }}>
        <div className="d-flex align-items-center justify-content-between px-3 py-2">
          <div className="fw-semibold">Glisse App</div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <CSidebar 
  className="d-none d-md-flex bg-white"
  visible
  style={{
    position: "sticky",
    top: 12, // match the margin so it sits nicely

    // ✅ viewport height minus top+bottom spacing
    height: "calc(100vh - 24px)",

    overflow: "hidden",

    margin: 12,
    borderRadius: 16,
    border: "1px solid #e9ecef",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  }}>
        <CSidebarHeader style={{
    borderBottom: "1px solid #e9ecef",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  }}>
          <CSidebarBrand>Glisse App</CSidebarBrand>
        </CSidebarHeader>

        <CSidebarNav className="d-flex flex-column"
  style={{ height: "100%", overflowY: "auto", padding: 8 }}>
          <CNavTitle className="glisse-navtitle">Navigation</CNavTitle>

          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} {...item} onClick={() => setMobileOpen(false)} iconsOnly={false} />
          ))}

          {currentUser?.role === "admin" && (
            <NavItemLink to="/admin/users" label="Admin" icon={cilPeople} onClick={() => {}} />
          )}

          <CNavItem className="mt-auto">
            <button
              type="button"
              className="glisse-navlink w-100 text-start"
              onClick={handleLogoutClick}
            >
              <CIcon className="nav-icon" icon={cilAccountLogout} />
              <span className="glisse-navtext">Logout</span>
            </button>
          </CNavItem>
        </CSidebarNav>
      </CSidebar>

      {/* Mobile sidebar */}
      <CSidebar
        className="border-end d-md-none"
        position="fixed"
        visible={mobileOpen}
        onVisibleChange={setMobileOpen}
        style={{ zIndex: 1040 }}
      >
        <CSidebarHeader className="border-bottom d-flex align-items-center justify-content-between">
          <CSidebarBrand>Glisse App</CSidebarBrand>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeMobile}>
            ✕
          </button>
        </CSidebarHeader>

        <CSidebarNav>
          <CNavTitle className="glisse-navtitle">Navigation</CNavTitle>

          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} {...item} onClick={closeMobile} iconsOnly={false} />
          ))}

          {currentUser?.role === "admin" && (
            <NavItemLink to="/admin/users" label="Admin" icon={cilPeople} onClick={closeMobile} />
          )}

          <CNavItem>
            <button
              type="button"
              className="glisse-navlink w-100 text-start"
              onClick={handleLogoutClick}
            >
              <CIcon className="nav-icon" icon={cilAccountLogout} />
              <span className="glisse-navtext">Logout</span>
            </button>
          </CNavItem>
        </CSidebarNav>
      </CSidebar>

      {mobileOpen && (
        <div
          className="d-md-none position-fixed top-0 start-0 w-100 h-100"
          style={{ background: "rgba(0,0,0,0.35)", zIndex: 1035 }}
          onClick={closeMobile}
        />
      )}
    </>
  );
};
