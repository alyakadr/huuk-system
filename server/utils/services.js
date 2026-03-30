const Service = require("../models/Service");

const DEFAULT_SERVICES = Object.freeze([
  { name: "Classic Haircut", duration: 30, price: 35 },
  { name: "Skin Fade", duration: 45, price: 45 },
  { name: "Beard Trim", duration: 20, price: 20 },
  { name: "Haircut + Beard", duration: 60, price: 55 },
  { name: "Kids Haircut", duration: 30, price: 25 },
]);

async function ensureDefaultServices() {
  for (const service of DEFAULT_SERVICES) {
    await Service.findOneAndUpdate(
      { name: service.name },
      {
        $setOnInsert: {
          name: service.name,
          duration: service.duration,
          price: service.price,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const services = await Service.find({}, "name duration price")
    .sort({ name: 1 })
    .lean();
  return services;
}

module.exports = {
  DEFAULT_SERVICES,
  ensureDefaultServices,
};
