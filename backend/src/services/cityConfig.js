const cityCatalog = {
  bhopal: { lat: 23.2599, lon: 77.4126, code: 'CITY-MP-BPL', name: 'Bhopal' },
  sehore: { lat: 23.2080, lon: 77.0816, code: 'CITY-MP-SHR', name: 'Sehore' },
  ashta: { lat: 23.0175, lon: 76.7221, code: 'CITY-MP-AST', name: 'Ashta' },
  indore: { lat: 22.7196, lon: 75.8577, code: 'CITY-MP-IDR', name: 'Indore' },
};

function normalizeCityName(cityName) {
  return String(cityName || '').trim().toLowerCase();
}

/**
 * Cities have historically been labelled with two code families: the pipeline
 * and spatial cells use CITY-MP-*, while the operator accounts and the QR
 * panel use CITY-IND-*. Both name the same municipality, so they are aliased
 * here instead of forcing existing accounts or printed QR codes to change.
 */
const cityCodeAliases = {
  'CITY-MP-BPL': ['CITY-IND-BPL8'],
  'CITY-MP-IDR': ['CITY-IND-INR6'],
  'CITY-MP-SHR': ['CITY-IND-SHR4'],
  'CITY-MP-AST': ['CITY-IND-AST4'],
};

const aliasToCanonical = new Map();
for (const [canonical, aliases] of Object.entries(cityCodeAliases)) {
  for (const alias of aliases) aliasToCanonical.set(alias, canonical);
}

export function normalizeCityCode(cityCode) {
  return String(cityCode || '').trim().toUpperCase();
}

/** The pipeline code that owns a city, whichever family the caller used. */
export function canonicalCityCode(cityCode) {
  const code = normalizeCityCode(cityCode);
  return aliasToCanonical.get(code) || code;
}

/** Every code that refers to the same city, including the one supplied. */
export function getCityCodeVariants(cityCode) {
  const code = normalizeCityCode(cityCode);
  if (!code) return [];
  const canonical = canonicalCityCode(code);
  const variants = new Set([code, canonical, ...(cityCodeAliases[canonical] || [])]);
  return [...variants].filter(Boolean);
}

/** Resolve a city catalog entry from either code family. */
export function getCityByCode(cityCode) {
  const canonical = canonicalCityCode(cityCode);
  return Object.values(cityCatalog).find((city) => city.code === canonical) || null;
}

export function isKnownCityCode(cityCode) {
  return Boolean(getCityByCode(cityCode));
}

export function getCity(cityName) {
  return cityCatalog[normalizeCityName(cityName)] || null;
}

export function getAvailableCityNames() {
  return Object.keys(cityCatalog);
}

export function getConfiguredCityNames() {
  const configured = (process.env.CITIES || 'bhopal,sehore,ashta')
    .split(',')
    .map(normalizeCityName)
    .filter(Boolean);

  const known = configured.filter((cityName) => cityCatalog[cityName]);
  return known.length ? [...new Set(known)] : ['bhopal', 'sehore', 'ashta'];
}

export function getConfiguredCities() {
  return getConfiguredCityNames().map((cityName) => [cityName, cityCatalog[cityName]]);
}
