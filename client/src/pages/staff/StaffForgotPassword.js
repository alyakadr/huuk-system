import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MdEmail, MdOutlineMarkEmailRead } from "react-icons/md";
import logo from "../../assets/logo.PNG";
import banner1 from "../../assets/banner1.png";
import http from "../../utils/httpClient";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const StaffForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isEmailValid = useMemo(
    () => EMAIL_REGEX.test(normalizedEmail),
    [normalizedEmail],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isEmailValid) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await http.post(`${API_BASE_URL}/auth/staff/forgot-password`, {
        email: normalizedEmail,
      });
      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          "We could not submit your request right now. Please try again in a moment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="staff-forgot-page">
      <div className="staff-forgot-backdrop" aria-hidden="true" />
      <section
        className="staff-forgot-card"
        aria-labelledby="staff-forgot-title"
      >
        <aside className="staff-forgot-brand-panel">
          <img src={banner1} alt="Huuk" className="staff-forgot-brand-image" />
          <div className="staff-forgot-brand-overlay" />
          <div className="staff-forgot-brand-content">
            <img src={logo} alt="Huuk logo" className="staff-forgot-logo" />
            <h1 className="staff-forgot-brand-title">Reset Access</h1>
            <p className="staff-forgot-brand-copy">
              Enter your staff account email and we will send reset instructions
              if the account exists.
            </p>
          </div>
        </aside>

        <div className="staff-forgot-form-panel">
          <h2 id="staff-forgot-title" className="staff-forgot-form-title">
            Forgot Password
          </h2>

          {isSuccess ? (
            <div
              className="staff-forgot-success"
              role="status"
              aria-live="polite"
            >
              <MdOutlineMarkEmailRead className="staff-forgot-success-icon" />
              <p>
                If your email is registered, reset instructions have been sent.
                Please check your inbox and spam folder for the link.
              </p>
            </div>
          ) : (
            <form
              className="staff-forgot-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <label htmlFor="staffForgotEmail" className="staff-forgot-label">
                Staff Email
              </label>
              <div className="staff-forgot-input-wrap">
                <MdEmail
                  className="staff-forgot-input-icon"
                  aria-hidden="true"
                />
                <input
                  id="staffForgotEmail"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errorMessage) {
                      setErrorMessage("");
                    }
                  }}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className={`staff-forgot-input ${errorMessage ? "is-error" : ""}`}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {errorMessage ? (
                <p className="staff-forgot-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                className="staff-forgot-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="staff-forgot-links">
            <Link to="/staff-login" className="staff-forgot-link">
              Back to Sign In
            </Link>
            <Link to="/" className="staff-forgot-link subtle">
              Customer Homepage
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default StaffForgotPassword;
