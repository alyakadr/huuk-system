const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

// Match frontend rule: at least one lower, upper, digit, special; no spaces; min length 8.
const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,}$/;

function isPasswordValid(password) {
  return typeof password === "string" && PASSWORD_POLICY_REGEX.test(password);
}

module.exports = {
  PASSWORD_POLICY_MESSAGE,
  isPasswordValid,
};
