export function readEnumParam(searchParams, key, allowedValues, defaultValue) {
  const raw = searchParams.get(key)
  if (!raw) return defaultValue
  return allowedValues.includes(raw) ? raw : defaultValue
}

export function readTextParam(searchParams, key, defaultValue = '') {
  const raw = searchParams.get(key)
  if (raw == null) return defaultValue
  return raw
}

export function buildSearchParams(currentParams, updates, defaults = {}) {
  const next = new URLSearchParams(currentParams)

  Object.entries(updates).forEach(([key, value]) => {
    const defaultValue = defaults[key]
    if (value == null || value === '' || value === defaultValue) {
      next.delete(key)
      return
    }
    next.set(key, String(value))
  })

  return next
}

export function didSearchParamsChange(currentParams, nextParams) {
  return currentParams.toString() !== nextParams.toString()
}
