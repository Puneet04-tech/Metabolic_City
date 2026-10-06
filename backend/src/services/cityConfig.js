const cityCatalog = {
  bhopal: { lat: 23.2599, lon: 77.4126, code: 'CITY-MP-BPL', name: 'Bhopal' },
  sehore: { lat: 23.2080, lon: 77.0816, code: 'CITY-MP-SHR', name: 'Sehore' },
  ashta: { lat: 23.0175, lon: 76.7221, code: 'CITY-MP-AST', name: 'Ashta' },
  indore: { lat: 22.7196, lon: 75.8577, code: 'CITY-MP-IDR', name: 'Indore' },
};

function normalizeCityName(cityName) {
  return String(cityName || '').trim().toLowerCase();
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
