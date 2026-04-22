// Shared client-side store for staff leave applications.
//
// NOTE: The backend does not yet expose a leave endpoint, so we persist
// submissions in localStorage under a single global key and keep all tabs
// in sync via storage events + a custom in-tab event. When the backend
// lands, swap loadAllLeaves/saveAllLeaves for API calls without touching
// the consumers (StaffAttendance, ManageStaffAttendance).

const STORAGE_KEY = "huuk_leave_applications";
const CHANGE_EVENT = "huuk:leaves-changed";

const safeParse = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Best-effort migration: pull any legacy per-user entries written by the
// older StaffAttendance implementation (key: staff_leave_requests_<id>)
// into the global store on first read, then drop the old keys.
const migrateLegacyEntries = () => {
  try {
    const global = safeParse(localStorage.getItem(STORAGE_KEY));
    const seenIds = new Set(global.map((l) => l.id));
    let migratedCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("staff_leave_requests_")) continue;
      const userId = key.replace("staff_leave_requests_", "");
      const entries = safeParse(localStorage.getItem(key));
      entries.forEach((entry) => {
        if (!entry || !entry.id || seenIds.has(entry.id)) return;
        global.push({
          ...entry,
          userId: entry.userId || userId,
        });
        seenIds.add(entry.id);
        migratedCount += 1;
      });
    }

    if (migratedCount > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(global));
    }

    // Clean up legacy keys regardless; they've been merged or are duplicates.
    const legacyKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("staff_leave_requests_")) legacyKeys.push(key);
    }
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* localStorage unavailable — nothing to do */
  }
};

let didMigrate = false;
const ensureMigrated = () => {
  if (didMigrate) return;
  didMigrate = true;
  migrateLegacyEntries();
};

export const loadAllLeaves = () => {
  ensureMigrated();
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

const writeAll = (leaves) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leaves));
  } catch {
    /* swallow — storage may be full or disabled */
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* no-op in non-DOM contexts */
  }
};

export const saveAllLeaves = (leaves) => {
  writeAll(Array.isArray(leaves) ? leaves : []);
};

export const addLeave = (leave) => {
  const current = loadAllLeaves();
  const next = [leave, ...current.filter((l) => l.id !== leave.id)];
  writeAll(next);
  return next;
};

export const updateLeave = (id, patch) => {
  const current = loadAllLeaves();
  let changed = false;
  const next = current.map((l) => {
    if (l.id !== id) return l;
    changed = true;
    return { ...l, ...patch };
  });
  if (changed) writeAll(next);
  return next;
};

export const removeLeave = (id) => {
  const current = loadAllLeaves();
  const next = current.filter((l) => l.id !== id);
  if (next.length !== current.length) writeAll(next);
  return next;
};

// Match on userId first (primary key). If no userId is available (e.g.
// the session hasn't fully hydrated yet), fall back to matching by
// username so the staff still sees their pending submissions instead of
// an empty list.
export const loadLeavesForUser = (userId, fallbackUsername) => {
  const uid = userId ? String(userId) : null;
  const uname = fallbackUsername
    ? String(fallbackUsername).trim().toLowerCase()
    : null;

  if (!uid && !uname) return loadAllLeaves();

  return loadAllLeaves().filter((l) => {
    if (uid && String(l.userId || "") === uid) return true;
    if (
      uname &&
      String(l.staffUsername || "")
        .trim()
        .toLowerCase() === uname
    ) {
      return true;
    }
    return false;
  });
};

const normOutlet = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

// Returns leaves whose date range covers `date`. Outlet is NOT filtered
// here — the caller decides whether to narrow by outlet. This keeps the
// manager view tolerant to staff with missing/mismatched outlet fields.
export const loadLeavesForDate = (date) => {
  if (!date) return [];
  const day = String(date).trim().slice(0, 10);
  return loadAllLeaves().filter((l) => {
    if (!l.startDate) return false;
    const end = l.endDate || l.startDate;
    if (day < String(l.startDate).slice(0, 10)) return false;
    if (day > String(end).slice(0, 10)) return false;
    return true;
  });
};

// Returns leaves whose date range covers `date` and (optionally) whose
// outlet matches (case + whitespace insensitive). Leaves without an
// outlet pass through so records submitted before the outlet was known
// still surface somewhere.
export const loadLeavesForOutletDate = ({ outlet, date }) => {
  if (!date) return [];
  const target = normOutlet(outlet);
  return loadLeavesForDate(date).filter((l) => {
    const own = normOutlet(l.outlet);
    if (target && own && own !== target) return false;
    return true;
  });
};

// Subscribe to changes from OTHER tabs (storage event) AND the current
// tab (custom event). Returns an unsubscribe function for useEffect.
export const subscribeToLeaves = (callback) => {
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) callback();
  };
  const handleCustom = () => callback();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, handleCustom);
  };
};

export const LEAVE_STORAGE_KEY = STORAGE_KEY;
