import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ProfileProvider } from "./ProfileContext";
import Homepage from "./pages/staff/Homepage";
import CustomerHomepage from "./pages/customer/CustomerHomepage";
import StaffDashboard from "./pages/staff/StaffDashboard";
import ManagerLayout from "./pages/staff/ManagerLayout";
import ManagerDashboard from "./pages/staff/ManagerDashboard";
import EditProfile from "./components/shared/EditProfile";
import SettingsPage from "./components/shared/Settings";
import Schedule from "./pages/staff/StaffSchedule";
import AppointmentManagement from "./pages/staff/ManagerAppointmentManagement";
import StaffAppointments from "./pages/staff/StaffAppointments";
import PaymentManagement from "./pages/staff/StaffPayments";
import SalesReport from "./pages/staff/SalesReport";
import StaffAttendance from "./pages/staff/StaffAttendance";
import StaffApproval from "./pages/staff/StaffApproval";
import StaffManagement from "./pages/staff/StaffManagement";
import CustomerManagement from "./pages/staff/CustomerManagement";
import PaymentSummary from "./pages/staff/PaymentSummary";
import ManagerSalesReport from "./pages/staff/ManagerSalesReport";
import StaffProfiles from "./pages/staff/StaffProfiles";
import ManageStaffAttendance from "./pages/staff/ManageStaffAttendance";
import StaffLayout from "./pages/staff/StaffLayout";
import api from "./utils/api"; // Updated import
import Booking from "./components/bookings/Booking";
import TimeSlotDebugger from "./debug/TimeSlotDebugger";
import SimpleClickTest from "./debug/SimpleClickTest";
import { useAuthSession, INTERFACE_ROLE } from "./hooks/useAuthSession";

// Error Boundary to catch invalid component errors
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Please refresh the page.</h1>;
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthSession(INTERFACE_ROLE.STAFF);

  if (!isAuthenticated || !user) {
    return <Navigate to="/staff-login" replace />;
  }

  const isStaffOrManager = user.role === "staff" || user.role === "manager";
  if (!isStaffOrManager) {
    console.warn(
      "Non-staff user attempting to access protected route:",
      user.role,
    );
    return <Navigate to="/staff-login" replace />;
  }

  return children;
};

const App = () => {
  const [searchResults, setSearchResults] = useState({
    clients: [],
    appointments: [],
    services: [],
  });

  const handleSearch = async (query) => {
    if (!query) {
      setSearchResults({ clients: [], appointments: [], services: [] });
      return;
    }
    try {
      const response = await api.get("/users/search", { params: { q: query } });
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  return (
    <ErrorBoundary>
      <ProfileProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Public routes */}
            <Route path="/homepage" element={<CustomerHomepage />} />
            <Route path="/staff-login" element={<Homepage />} />
            <Route path="/" element={<CustomerHomepage />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/debug/timeslot" element={<TimeSlotDebugger />} />
            <Route path="/debug/click" element={<SimpleClickTest />} />
            {/* Staff routes */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={<StaffDashboard searchResults={searchResults} />}
              />
              <Route path="schedule" element={<Schedule />} />
              <Route path="appointments" element={<StaffAppointments />} />
              <Route path="payments" element={<PaymentManagement />} />
              <Route path="reports" element={<SalesReport />} />
              <Route path="attendance" element={<StaffAttendance />} />
              <Route
                path="settings"
                element={<SettingsPage key={window.location.pathname} />}
              />
              <Route
                path="edit-profile"
                element={<EditProfile key={window.location.pathname} />}
              />
            </Route>
            {/* Manager routes */}
            <Route
              path="/manager"
              element={
                <ProtectedRoute>
                  <ManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={<ManagerDashboard searchResults={searchResults} />}
              />
              <Route
                path="customer-management"
                element={<CustomerManagement />}
              />
              <Route path="staff-management" element={<StaffManagement />} />
              <Route path="staff-approval" element={<StaffApproval />} />
              <Route path="staff-profile" element={<StaffProfiles />} />
              <Route
                path="appointment-management"
                element={<AppointmentManagement />}
              />
              <Route path="payment-summary" element={<PaymentSummary />} />
              <Route path="sales-report" element={<ManagerSalesReport />} />
              <Route
                path="staff-attendance"
                element={<ManageStaffAttendance />}
              />
              <Route
                path="settings"
                element={<SettingsPage key={window.location.pathname} />}
              />
              <Route
                path="edit-profile"
                element={<EditProfile key={window.location.pathname} />}
              />
            </Route>
          </Routes>
        </Router>
      </ProfileProvider>
    </ErrorBoundary>
  );
};

export default App;
