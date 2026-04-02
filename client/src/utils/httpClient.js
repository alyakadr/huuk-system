const isAbsoluteUrl = (url = "") => /^https?:\/\//i.test(url);

const trimSlashes = (value = "") => value.replace(/^\/+|\/+$/g, "");

const joinUrl = (baseURL = "", url = "") => {
  if (!baseURL) return url;
  if (!url) return baseURL;
  if (isAbsoluteUrl(url)) return url;
  return `${trimSlashes(baseURL)}/${trimSlashes(url)}`;
};

const serializeParams = (params) => {
  if (!params) return "";

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const toPlainHeaders = (headers) => {
  const result = {};
  if (!headers) return result;
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

const createInterceptorManager = () => {
  const handlers = [];

  return {
    handlers,
    use(onFulfilled, onRejected) {
      handlers.push({ onFulfilled, onRejected });
      return handlers.length - 1;
    },
    eject(id) {
      if (handlers[id]) handlers[id] = null;
    },
  };
};

const makeHttpError = ({ message, config, response, code }) => {
  const error = new Error(message);
  error.name = "HttpClientError";
  error.config = config;
  error.response = response;
  error.code = code;
  return error;
};

const mergeHeaders = (...headerSets) => {
  return headerSets.reduce((acc, set) => {
    if (!set) return acc;
    Object.entries(set).forEach(([key, value]) => {
      if (value !== undefined) acc[key] = value;
    });
    return acc;
  }, {});
};

const createInstance = (defaults = {}) => {
  const interceptors = {
    request: createInterceptorManager(),
    response: createInterceptorManager(),
  };

  const dispatchRequest = async (config) => {
    const mergedConfig = {
      method: "get",
      ...defaults,
      ...config,
    };

    const method = (mergedConfig.method || "get").toUpperCase();
    const baseURL = mergedConfig.baseURL || defaults.baseURL || "";
    const requestUrl = mergedConfig.url || "";
    const urlWithBase = isAbsoluteUrl(requestUrl)
      ? requestUrl
      : joinUrl(baseURL, requestUrl);
    const finalUrl = `${urlWithBase}${serializeParams(mergedConfig.params)}`;

    const headers = mergeHeaders(defaults.headers, mergedConfig.headers);
    const requestInit = {
      method,
      headers,
    };

    const body = mergedConfig.data;
    if (body !== undefined && body !== null && method !== "GET" && method !== "HEAD") {
      const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
      const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
      const isArrayBuffer = body instanceof ArrayBuffer;
      const isString = typeof body === "string";

      if (isFormData || isBlob || isArrayBuffer || isString) {
        requestInit.body = body;
      } else {
        requestInit.body = JSON.stringify(body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
          requestInit.headers = {
            ...requestInit.headers,
            "Content-Type": "application/json",
          };
        }
      }
    }

    let timeoutId = null;
    let timeoutController = null;

    if (mergedConfig.timeout && mergedConfig.timeout > 0) {
      timeoutController = new AbortController();
      requestInit.signal = timeoutController.signal;

      if (mergedConfig.signal) {
        mergedConfig.signal.addEventListener("abort", () => timeoutController.abort(), {
          once: true,
        });
      }

      timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, mergedConfig.timeout);
    } else if (mergedConfig.signal) {
      requestInit.signal = mergedConfig.signal;
    }

    try {
      const rawResponse = await fetch(finalUrl, requestInit);

      if (timeoutId) clearTimeout(timeoutId);

      const contentType = rawResponse.headers.get("content-type") || "";
      let parsedData;

      if (contentType.includes("application/json")) {
        parsedData = await rawResponse.json();
      } else {
        parsedData = await rawResponse.text();
      }

      const response = {
        data: parsedData,
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: toPlainHeaders(rawResponse.headers),
        config: mergedConfig,
        request: null,
      };

      if (!rawResponse.ok) {
        throw makeHttpError({
          message: `Request failed with status code ${rawResponse.status}`,
          config: mergedConfig,
          response,
          code: "ERR_BAD_RESPONSE",
        });
      }

      return response;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);

      if (error.name === "HttpClientError") {
        throw error;
      }

      const isAbort = error.name === "AbortError";
      throw makeHttpError({
        message: isAbort ? "timeout of request exceeded" : error.message || "Network Error",
        config: mergedConfig,
        response: undefined,
        code: isAbort ? "ECONNABORTED" : "ERR_NETWORK",
      });
    }
  };

  const request = (configOrUrl, maybeConfig) => {
    const normalizedConfig =
      typeof configOrUrl === "string"
        ? { ...(maybeConfig || {}), url: configOrUrl }
        : { ...(configOrUrl || {}) };

    let chain = Promise.resolve(normalizedConfig);

    interceptors.request.handlers.forEach((handler) => {
      if (!handler) return;
      chain = chain.then(handler.onFulfilled, handler.onRejected);
    });

    chain = chain.then(dispatchRequest);

    interceptors.response.handlers.forEach((handler) => {
      if (!handler) return;
      chain = chain.then(handler.onFulfilled, handler.onRejected);
    });

    return chain;
  };

  const instance = (config) => request(config);

  instance.defaults = defaults;
  instance.interceptors = interceptors;

  instance.request = (config) => request(config);
  instance.get = (url, config = {}) => request({ ...config, url, method: "get" });
  instance.delete = (url, config = {}) => request({ ...config, url, method: "delete" });
  instance.head = (url, config = {}) => request({ ...config, url, method: "head" });
  instance.options = (url, config = {}) => request({ ...config, url, method: "options" });
  instance.post = (url, data, config = {}) => request({ ...config, url, data, method: "post" });
  instance.put = (url, data, config = {}) => request({ ...config, url, data, method: "put" });
  instance.patch = (url, data, config = {}) => request({ ...config, url, data, method: "patch" });

  return instance;
};

const httpClient = createInstance({});
httpClient.create = (config = {}) => createInstance(config);

export default httpClient;
