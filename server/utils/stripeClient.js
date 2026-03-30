const stripeFactory = require("stripe");

const STRIPE_SECRET_KEY_CANDIDATES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_SECRET",
  "STRIPE_API_KEY",
];

function resolveStripeSecretKey() {
  for (const keyName of STRIPE_SECRET_KEY_CANDIDATES) {
    const value = process.env[keyName];
    if (value && String(value).trim()) {
      return { key: String(value).trim(), source: keyName };
    }
  }
  return { key: "", source: null };
}

function isLikelyPlaceholderKey(secretKey) {
  const value = String(secretKey || "").trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes("your_stripe_secret_key") ||
    lower.includes("replace_me") ||
    lower.includes("changeme") ||
    value.includes("*")
  );
}

function isValidStripeSecretKey(secretKey) {
  const value = String(secretKey || "").trim();
  if (!value) return false;
  if (!/^sk_(test|live)_/.test(value)) return false;
  if (value.length < 20) return false;
  if (isLikelyPlaceholderKey(value)) return false;
  return true;
}

function getStripeClient() {
  const { key, source } = resolveStripeSecretKey();
  if (!isValidStripeSecretKey(key)) {
    return {
      stripe: null,
      key,
      source,
      configError:
        "Stripe secret key is missing or invalid. Set a real sk_test_... or sk_live_... key in STRIPE_SECRET_KEY.",
    };
  }

  return {
    stripe: stripeFactory(key),
    key,
    source,
    configError: null,
  };
}

module.exports = {
  resolveStripeSecretKey,
  isValidStripeSecretKey,
  getStripeClient,
};
