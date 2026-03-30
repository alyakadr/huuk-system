const Outlet = require("../models/Outlet");

const STATIC_OUTLETS = Object.freeze([
  { name: "Mid Valley Megamall (Centre Court)", shortform: "MVC" },
  { name: "Mid Valley Megamall (North Court)", shortform: "MVN" },
  { name: "Pavilion KL", shortform: "PKL" },
  { name: "Pavilion Bukit Jalil", shortform: "PBJ" },
  { name: "Pavilion Damansara Heights", shortform: "PDH" },
  { name: "Sunway Pyramid", shortform: "SWP" },
  { name: "IOI City Mall", shortform: "IOI" },
  { name: "Wangsa Walk Mall", shortform: "WWM" },
  { name: "Melawati Mall", shortform: "MEL" },
  { name: "Solaris Dutamas (Publika)", shortform: "PUB" },
  { name: "1 Utama Shopping Centre", shortform: "ONU" },
  { name: "Lot 10 Shopping Centre", shortform: "L10" },
  { name: "Setia City Mall", shortform: "SCM" },
  { name: "The Exchange TRX", shortform: "TRX" },
  { name: "The Starling Mall", shortform: "STM" },
]);

const LEGACY_SHORTFORM_MAP = Object.freeze({
  SPY: "SWP",
  OUN: "ONU",
  ICM: "IOI",
  MLM: "MEL",
  LBB: "L10",
  WW1: "WWM",
});

async function normalizeLegacyShortforms() {
  const entries = Object.entries(LEGACY_SHORTFORM_MAP);
  for (const [legacy, next] of entries) {
    const legacyDoc = await Outlet.findOne({ shortform: legacy }).lean();
    if (!legacyDoc) continue;

    const nextDef = STATIC_OUTLETS.find((o) => o.shortform === next);
    if (!nextDef) continue;

    const existingTarget = await Outlet.findOne({ shortform: next }).lean();
    if (
      existingTarget &&
      String(existingTarget._id) !== String(legacyDoc._id)
    ) {
      await Outlet.findByIdAndDelete(legacyDoc._id);
      continue;
    }

    await Outlet.updateOne(
      { _id: legacyDoc._id },
      { $set: { shortform: nextDef.shortform, name: nextDef.name } },
    );
  }
}

async function ensureStaticOutlets() {
  await normalizeLegacyShortforms();

  for (const outlet of STATIC_OUTLETS) {
    await Outlet.findOneAndUpdate(
      { shortform: outlet.shortform },
      { $set: { name: outlet.name, shortform: outlet.shortform } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const all = await Outlet.find({}, "name shortform").lean();
  const byShortform = new Map(all.map((o) => [o.shortform, o]));

  return STATIC_OUTLETS.map((def) => byShortform.get(def.shortform)).filter(
    Boolean,
  );
}

module.exports = {
  STATIC_OUTLETS,
  ensureStaticOutlets,
};
