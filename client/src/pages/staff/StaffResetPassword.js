import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MdCheckCircleOutline,
  MdLock,
  MdOutlineErrorOutline,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import logo from "../../assets/logo.PNG";
import banner1 from "../../assets/banner1.png";
import http from "../../utils/httpClient";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

const VALIDATION_STATE = {
  LOADING: "loading",
  READY: "ready",
  INVALID: "invalid",
  SUCCESS: "success",
};

const StaffResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validationState, setValidationState] = useState(
    VALIDATION_STATE.LOADING,
  );
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isPasswordValid = useMemo(
    () => PASSWORD_POLICY_REGEX.test(password),
    [password],
  );

  useEffect(() => {
    let isActive = true;

    const validateResetToken = async () => {
      if (!token) {
        setValidationState(VALIDATION_STATE.INVALID);
        setErrorMessage("This reset link is missing or incomplete.");
        return;
      }

      try {
        const response = await http.get(
          `${API_BASE_URL}/auth/staff/reset-password/validate`,
          {
            params: { token },
          },
        );

        if (!isActive) {
          return;
        }

        setAccountEmail(response.data?.email || "");
        setValidationState(VALIDATION_STATE.READY);
        setErrorMessage("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setValidationState(VALIDATION_STATE.INVALID);
        setErrorMessage(
          error?.response?.data?.message ||
            "This reset link is invalid or has expired.",
        );
      }
    };

    validateResetToken();

    return () => {
      isActive = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isPasswordValid) {
      setErrorMessage(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await http.post(`${API_BASE_URL}/auth/staff/reset-password`, {
        token,
        password,
      });

      setValidationState(VALIDATION_STATE.SUCCESS);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "We could not reset your password right now. Please request a new link.";

      setErrorMessage(message);
      if (error?.response?.status === 401) {
        setValidationState(VALIDATION_STATE.INVALID);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (validationState === VALIDATION_STATE.LOADING) {
      return (
        <div
          className="staff-reset-feedback-card"
          role="status"
          aria-live="polite"
        >
          <p>Validating your reset link...</p>
        </div>
      );
    }

    if (validationState === VALIDATION_STATE.INVALID) {
      return (
        <div className="staff-reset-feedback-card is-error" role="alert">
          <MdOutlineErrorOutline className="staff-reset-feedback-icon" />
          <div>
            <h3>Link Unavailable</h3>
            <p>{errorMessage}</p>
          </div>
        </div>
      );
    }

    if (validationState === VALIDATION_STATE.SUCCESS) {
      return (
        <div
          className="staff-reset-feedback-card is-success"
          role="status"
          aria-live="polite"
        >
          <MdCheckCircleOutline className="staff-reset-feedback-icon" />
          <div>
            <h3>Password Updated</h3>
            <p>Your staff account password has been reset successfully.</p>
          </div>
        </div>
      );
    }

    return (
      <form className="staff-reset-form" onSubmit={handleSubmit} noValidate>
        <p className="staff-reset-helper-copy">
          Resetting password for {accountEmail || "your staff account"}.
        </p>

        <label htmlFor="staffResetPassword" className="staff-reset-label">
          New Password
        </label>
        <div className="staff-reset-input-wrap">
          <MdLock className="staff-reset-input-icon" aria-hidden="true" />
          <input
            id="staffResetPassword"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errorMessage) {
                setErrorMessage("");
              }
            }}
            className={`staff-reset-input ${errorMessage ? "is-error" : ""}`}
            autoComplete="new-password"
            disabled={isSubmitting}
            required
          />
          <button
            type="button"
            className="staff-reset-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
          </button>
        </div>

        <label
          htmlFor="staffResetConfirmPassword"
          className="staff-reset-label"
        >
          Confirm Password
        </label>
        <div className="staff-reset-input-wrap">
          <MdLock className="staff-reset-input-icon" aria-hidden="true" />
          <input
            id="staffResetConfirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (errorMessage) {
                setErrorMessage("");
              }
            }}
            className={`staff-reset-input ${errorMessage ? "is-error" : ""}`}
            autoComplete="new-password"
            disabled={isSubmitting}
            required
          />
          <button
            type="button"
            className="staff-reset-toggle"
            onClick={() => setShowConfirmPassword((current) => !current)}
            aria-label={
              showConfirmPassword
                ? "Hide confirm password"
                : "Show confirm password"
            }
          >
            {showConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
          </button>
        </div>

        <p className="staff-reset-policy">{PASSWORD_POLICY_MESSAGE}</p>

        {errorMessage ? (
          <p className="staff-reset-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          className="staff-reset-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    );
  };

  return (
    <main className="staff-reset-page">
      <div className="staff-reset-backdrop" aria-hidden="true" />
      <section className="staff-reset-card" aria-labelledby="staff-reset-title">
        <aside className="staff-reset-brand-panel">
          <img src={banner1} alt="Huuk" className="staff-reset-brand-image" />
          <div className="staff-reset-brand-overlay" />
          <div className="staff-reset-brand-content">
            <img src={logo} alt="Huuk logo" className="staff-reset-logo" />
            <h1 className="staff-reset-brand-title">Set A New Password</h1>
            <p className="staff-reset-brand-copy">
              Choose a strong password for your staff portal and keep your
              account secure.
            </p>
          </div>
        </aside>

        <div className="staff-reset-form-panel">
          <h2 id="staff-reset-title" className="staff-reset-form-title">
            Reset Password
          </h2>
          {renderContent()}
          <div className="staff-reset-links">
            <Link to="/staff-login" className="staff-reset-link">
              Back to Sign In
            </Link>
            <Link
              to="/staff-forgot-password"
              className="staff-reset-link subtle"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default StaffResetPassword;
