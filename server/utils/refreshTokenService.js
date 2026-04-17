const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const REFRESH_DAYS = Math.min(
  90,
  Math.max(1, parseInt(process.env.REFRESH_TOKEN_DAYS || "14", 10)),
);
const RAW_BYTE_LEN = 32;

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function refreshCookieMaxAgeMs() {
  return REFRESH_DAYS * 24 * 60 * 60 * 1000;
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(RAW_BYTE_LEN).toString("base64url");
  const token_hash = hashToken(raw);
  const expires_at = new Date(Date.now() + refreshCookieMaxAgeMs());
  await RefreshToken.create({
    user_id: userId,
    token_hash,
    expires_at,
  });
  return { raw, expires_at };
}

/**
 * Validates refresh token, removes it, issues a new one (rotation).
 * @returns {Promise<{ userId: import("mongoose").Types.ObjectId, newRaw: string } | null>}
 */
async function rotateRefreshToken(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const token_hash = hashToken(raw.trim());
  const doc = await RefreshToken.findOne({ token_hash });
  if (!doc) {
    return null;
  }
  if (doc.expires_at < new Date()) {
    await RefreshToken.deleteOne({ _id: doc._id });
    return null;
  }
  const userId = doc.user_id;
  await RefreshToken.deleteOne({ _id: doc._id });
  const { raw: newRaw } = await issueRefreshToken(userId);
  return { userId, newRaw };
}

async function revokeRefreshToken(raw) {
  if (!raw || typeof raw !== "string") {
    return;
  }
  await RefreshToken.deleteOne({ token_hash: hashToken(raw.trim()) });
}

async function revokeAllForUser(userId) {
  await RefreshToken.deleteMany({ user_id: userId });
}

module.exports = {
  hashToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  refreshCookieMaxAgeMs,
  REFRESH_DAYS,
};
