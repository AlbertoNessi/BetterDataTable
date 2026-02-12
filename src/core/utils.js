export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function deepMerge(target, source) {
  const output = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepMerge(target[key] || {}, value);
      continue;
    }

    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

export function isDomNode(value) {
  return typeof Node !== "undefined" && value instanceof Node;
}

export function toText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function uniqueId(prefix = "bdt") {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

export function parseAccessor(accessor) {
  if (typeof accessor === "function") {
    return accessor;
  }

  if (typeof accessor === "string" && accessor.length > 0) {
    const path = accessor.split(".");
    return (row) => {
      let value = row;
      for (const key of path) {
        if (value === null || value === undefined) {
          return undefined;
        }
        value = value[key];
      }
      return value;
    };
  }

  return (row) => row;
}

export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}
