const isDebugEnabled = process.env.NODE_ENV !== "production";

export const debugLog = (...args) => {
  if (isDebugEnabled) {
    console.log(...args);
  }
};
