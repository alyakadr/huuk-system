/**
 * Scoped Socket.IO emits (rooms are joined in app.js connection middleware).
 */

function emitToUser(io, userId, event, payload) {
  if (!io || userId == null || userId === "") return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToInternalStaff(io, event, payload) {
  if (!io) return;
  io.to("internal_staff").emit(event, payload);
}

function emitToManagers(io, event, payload) {
  if (!io) return;
  io.to("role:manager").emit(event, payload);
}

/** Customer payment events: notify the booker and staff dashboards. */
function emitBookingUpdated(io, userId, payload) {
  emitToUser(io, userId, "booking_updated", payload);
  emitToInternalStaff(io, "booking_updated", payload);
}

module.exports = {
  emitToUser,
  emitToInternalStaff,
  emitToManagers,
  emitBookingUpdated,
};
