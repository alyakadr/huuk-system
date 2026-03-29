import { useCallback, useState } from "react";

export const useFetch = ({ request, onSuccess, onError }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      try {
        setLoading(true);
        setError(null);
        const responseData = await request(...args);
        setData(responseData);

        if (onSuccess) {
          onSuccess(responseData);
        }

        return responseData;
      } catch (requestError) {
        setError(requestError);

        if (onError) {
          onError(requestError);
        }

        throw requestError;
      } finally {
        setLoading(false);
      }
    },
    [request, onSuccess, onError],
  );

  return {
    data,
    loading,
    error,
    execute,
    setData,
  };
};
