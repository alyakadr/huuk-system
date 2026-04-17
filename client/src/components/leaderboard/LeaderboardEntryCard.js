import React from "react";

/**
 * Joins location parts with a comma; omits empty values.
 */
export function formatDaerahNegeri(daerah, negeri) {
  return [daerah, negeri].filter(Boolean).join(", ");
}

const lineClass =
  "m-0 max-w-full truncate text-[13px] font-medium leading-snug text-white/70";
const titleClass =
  "m-0 max-w-full truncate text-[15px] font-bold leading-tight text-white";

/**
 * Shared leaderboard row: primary title + optional secondary lines only.
 * Intentionally ignores stats, descriptions, or other meta (e.g. "4 guru aktif").
 */
export function LeaderboardEntryCard({
  title,
  lines,
  className = "",
  rankSlot,
}) {
  const safeLines = (lines || []).filter(
    (line) => line != null && String(line).trim() !== "",
  );

  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 ${className}`.trim()}
    >
      {rankSlot != null ? (
        <div className="shrink-0 pt-0.5 text-sm font-bold tabular-nums text-[#ffc50f]">
          {rankSlot}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={titleClass}>{title}</p>
        {safeLines.map((line, i) => (
          <p key={i} className={lineClass}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Ranking Murid Terbaik: name → school → Daerah, Negeri
 */
export function studentEntryToCardProps(entry) {
  const {
    studentName,
    name,
    schoolName,
    namaSekolah,
    daerah,
    negeri,
  } = entry;
  const title = studentName || name || "";
  const school = schoolName || namaSekolah || "";
  const locationLine = formatDaerahNegeri(daerah, negeri);
  const lines = [school, locationLine].filter((s) => s && s.trim());
  return { title, lines };
}

/**
 * Ranking Sekolah Terbaik: school → Daerah, Negeri
 */
export function schoolEntryToCardProps(entry) {
  const { schoolName, namaSekolah, name, daerah, negeri } = entry;
  const title = schoolName || namaSekolah || name || "";
  const lines = [formatDaerahNegeri(daerah, negeri)].filter(
    (s) => s && String(s).trim(),
  );
  return { title, lines };
}

/**
 * Ranking Negeri Terbaik: negeri → Daerah only
 */
export function stateEntryToCardProps(entry) {
  const { negeriName, negeri, name, daerah } = entry;
  const title = negeriName || negeri || name || "";
  const lines = daerah != null && String(daerah).trim() ? [String(daerah)] : [];
  return { title, lines };
}
