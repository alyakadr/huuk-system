const METRIC_LIMIT = 100;
const metricsStore = [];

export const recordRequestMetric = (metric) => {
  metricsStore.push({
    ...metric,
    timestamp: new Date().toISOString(),
  });

  if (metricsStore.length > METRIC_LIMIT) {
    metricsStore.splice(0, metricsStore.length - METRIC_LIMIT);
  }
};

export const getRequestMetrics = () => {
  return [...metricsStore];
};

export const clearRequestMetrics = () => {
  metricsStore.length = 0;
};
