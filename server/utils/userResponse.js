const path = require("path");
const fs = require("fs");

const DEFAULT_PIC = "/Uploads/profile_pictures/default.jpg";

function resolveProfilePictureFile(userDoc, serverRoot) {
  let pic = userDoc.profile_picture;
  if (!pic || pic === "/Uploads/profile_pictures/null") {
    return DEFAULT_PIC;
  }
  const filePath = path.join(serverRoot, pic);
  if (!fs.existsSync(filePath)) {
    return DEFAULT_PIC;
  }
  return pic;
}

/** Lean user + profile fields → API shape (SQL `id` compatibility). */
function toProfilePayload(userLean, serverRoot) {
  const status = userLean.isApproved === 1 ? "approved" : "pending";
  const profile_picture = resolveProfilePictureFile(userLean, serverRoot);
  return {
    id: userLean._id.toString(),
    fullname: userLean.fullname,
    username: userLean.username,
    email: userLean.email,
    address: userLean.address ?? null,
    phone_number: userLean.phone_number ?? null,
    profile_picture,
    role: userLean.role,
    outlet: userLean.outlet,
    status,
  };
}

module.exports = { toProfilePayload, resolveProfilePictureFile, DEFAULT_PIC };
