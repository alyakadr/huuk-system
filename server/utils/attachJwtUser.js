const mongoose = require("mongoose");

/**
 * Sets req.userId (hex string) and req.userObjectId (ObjectId) from JWT payload.
 * @returns {boolean} false if userId is missing or not a valid ObjectId
 */
function attachJwtUserIds(req, decodedUserId) {
  if (decodedUserId == null || decodedUserId === "") return false;
  const str = String(decodedUserId);
  if (!mongoose.Types.ObjectId.isValid(str)) return false;
  req.userId = str;
  req.userObjectId = new mongoose.Types.ObjectId(str);
  return true;
}

module.exports = { attachJwtUserIds };
