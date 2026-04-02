export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (
  operation,
  { retries = 5, delayBase = 2000, shouldRetry = () => true, onRetry } = {},
) => {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === retries - 1;
      if (isLastAttempt || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = delayBase * (attempt + 1) * 2;
      if (typeof onRetry === "function") {
        onRetry(error, attempt + 1, delay);
      }
      await wait(delay);
    }
  }

  throw lastError;
};
