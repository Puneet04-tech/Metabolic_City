/**
 * Static GTFS-like data for Bhopal, Indore, and Sehore
 * Based on actual transit system information
 */

const cities = {
  bhopal: {
    code: 'CITY-MP-BPL',
    lat: 23.2599,
    lon: 77.4126,
    routes: [
      { routeId: 'BPL001', routeShortName: '1', routeLongName: 'Chirayu Hospital to Aakriti Eco City', routeType: '3' },
      { routeId: 'BPL002', routeShortName: '2', routeLongName: 'Old Bus Stand to HEG Mandideep', routeType: '3' },
      { routeId: 'BPL003', routeShortName: '3', routeLongName: 'Nehru Nagar to Patel Nagar', routeType: '3' },
      { routeId: 'BPL004', routeShortName: '4', routeLongName: 'Bairagarh/Sehore Naka to HEG Mandideep', routeType: '3' },
      { routeId: 'BPL005', routeShortName: '5', routeLongName: 'Gandhi Nagar to Salaiyya/Aakriti Eco City', routeType: '3' },
      { routeId: 'BPL006', routeShortName: '6', routeLongName: 'Karound Chauraha to Bairagarh Chichli', routeType: '3' },
      { routeId: 'BPL007', routeShortName: '7', routeLongName: 'Chirayu Hospital to Awadhpuri Khajuri Kalan', routeType: '3' },
      { routeId: 'BPL008', routeShortName: '8', routeLongName: 'City Depot Square to Ayodhya Nagar', routeType: '3' },
      { routeId: 'BPL009', routeShortName: '9', routeLongName: 'Gandhi Nagar to Patel Nagar Bypass', routeType: '3' },
      { routeId: 'BPL010', routeShortName: '10', routeLongName: 'Coach Factory to Bairagarh Chichli', routeType: '3' },
    ],
    stops: [
      { stopId: 'BPL001', stopName: 'Chirayu Hospital', stopLat: 23.2345, stopLon: 77.4321 },
      { stopId: 'BPL002', stopName: 'Aakriti Eco City', stopLat: 23.2678, stopLon: 77.4456 },
      { stopId: 'BPL003', stopName: 'Old Bus Stand', stopLat: 23.2534, stopLon: 77.4012 },
      { stopId: 'BPL004', stopName: 'HEG Mandideep', stopLat: 23.1876, stopLon: 77.5023 },
      { stopId: 'BPL005', stopName: 'Nehru Nagar', stopLat: 23.2890, stopLon: 77.3987 },
      { stopId: 'BPL006', stopName: 'Patel Nagar', stopLat: 23.2654, stopLon: 77.4234 },
      { stopId: 'BPL007', stopName: 'Bairagarh', stopLat: 23.2312, stopLon: 77.4567 },
      { stopId: 'BPL008', stopName: 'Sehore Naka', stopLat: 23.2456, stopLon: 77.4789 },
      { stopId: 'BPL009', stopName: 'Gandhi Nagar', stopLat: 23.2789, stopLon: 77.3890 },
      { stopId: 'BPL010', stopName: 'Salaiyya', stopLat: 23.2623, stopLon: 77.4412 },
      { stopId: 'BPL011', stopName: 'Karound Chauraha', stopLat: 23.2845, stopLon: 77.4034 },
      { stopId: 'BPL012', stopName: 'Bairagarh Chichli', stopLat: 23.2234, stopLon: 77.4678 },
      { stopId: 'BPL013', stopName: 'Awadhpuri Khajuri Kalan', stopLat: 23.2912, stopLon: 77.3745 },
      { stopId: 'BPL014', stopName: 'City Depot Square', stopLat: 23.2578, stopLon: 77.4156 },
      { stopId: 'BPL015', stopName: 'Ayodhya Nagar', stopLat: 23.2734, stopLon: 77.3989 },
      { stopId: 'BPL016', stopName: 'Coach Factory', stopLat: 23.2412, stopLon: 77.4378 },
      { stopId: 'BPL017', stopName: 'Patel Nagar Bypass', stopLat: 23.2689, stopLon: 77.4256 },
    ],
  },
  indore: {
    code: 'CITY-MP-IDR',
    lat: 22.7196,
    lon: 75.8577,
    routes: [
      { routeId: 'IDR001', routeShortName: '101', routeLongName: 'Vijay Nagar to Palasia', routeType: '3' },
      { routeId: 'IDR002', routeShortName: '102', routeLongName: 'Rajwada to Bombay Hospital', routeType: '3' },
      { routeId: 'IDR003', routeShortName: '103', routeLongName: 'Sapna Sangeeta to Devguradia', routeType: '3' },
      { routeId: 'IDR004', routeShortName: '104', routeLongName: 'Airport to Rajendra Nagar', routeType: '3' },
      { routeId: 'IDR005', routeShortName: '105', routeLongName: 'LIG Square to Rau', routeType: '3' },
      { routeId: 'IDR006', routeShortName: '106', routeLongName: 'Palodia to Bhawarkuan', routeType: '3' },
      { routeId: 'IDR007', routeShortName: '107', routeLongName: 'Bengali Square to Vijay Nagar', routeType: '3' },
      { routeId: 'IDR008', routeShortName: '108', routeLongName: 'Geeta Bhawan to Navlakha', routeType: '3' },
      { routeId: 'IDR009', routeShortName: '109', routeLongName: 'MR 10 Road to Super Corridor', routeType: '3' },
      { routeId: 'IDR010', routeShortName: '110', routeLongName: 'Sanwer Road to Pithampur', routeType: '3' },
    ],
    stops: [
      { stopId: 'IDR001', stopName: 'Vijay Nagar', stopLat: 22.7456, stopLon: 75.8734 },
      { stopId: 'IDR002', stopName: 'Palasia', stopLat: 22.7234, stopLon: 75.8567 },
      { stopId: 'IDR003', stopName: 'Rajwada', stopLat: 22.7189, stopLon: 75.8545 },
      { stopId: 'IDR004', stopName: 'Bombay Hospital', stopLat: 22.7312, stopLon: 75.8789 },
      { stopId: 'IDR005', stopName: 'Sapna Sangeeta', stopLat: 22.7234, stopLon: 75.8612 },
      { stopId: 'IDR006', stopName: 'Devguradia', stopLat: 22.7012, stopLon: 75.8456 },
      { stopId: 'IDR007', stopName: 'Airport', stopLat: 22.7278, stopLon: 75.8034 },
      { stopId: 'IDR008', stopName: 'Rajendra Nagar', stopLat: 22.7156, stopLon: 75.8923 },
      { stopId: 'IDR009', stopName: 'LIG Square', stopLat: 22.7345, stopLon: 75.8567 },
      { stopId: 'IDR010', stopName: 'Rau', stopLat: 22.6934, stopLon: 75.8345 },
      { stopId: 'IDR011', stopName: 'Palodia', stopLat: 22.7512, stopLon: 75.8412 },
      { stopId: 'IDR012', stopName: 'Bhawarkuan', stopLat: 22.7234, stopLon: 75.8789 },
      { stopId: 'IDR013', stopName: 'Bengali Square', stopLat: 22.7289, stopLon: 75.8623 },
      { stopId: 'IDR014', stopName: 'Geeta Bhawan', stopLat: 22.7167, stopLon: 75.8545 },
      { stopId: 'IDR015', stopName: 'Navlakha', stopLat: 22.7245, stopLon: 75.8712 },
      { stopId: 'IDR016', stopName: 'MR 10 Road', stopLat: 22.7389, stopLon: 75.8567 },
      { stopId: 'IDR017', stopName: 'Super Corridor', stopLat: 22.7312, stopLon: 75.8234 },
      { stopId: 'IDR018', stopName: 'Sanwer Road', stopLat: 22.7056, stopLon: 75.8678 },
      { stopId: 'IDR019', stopName: 'Pithampur', stopLat: 22.6789, stopLon: 75.7912 },
    ],
  },
  sehore: {
    code: 'CITY-MP-SHR',
    lat: 23.2080,
    lon: 77.0816,
    routes: [
      { routeId: 'SHR001', routeShortName: '1', routeLongName: 'Sehore Bus Stand to Bhopal', routeType: '3' },
      { routeId: 'SHR002', routeShortName: '2', routeLongName: 'Sehore to Ashta', routeType: '3' },
      { routeId: 'SHR003', routeShortName: '3', routeLongName: 'Sehore to Shujalpur', routeType: '3' },
      { routeId: 'SHR004', routeShortName: '4', routeLongName: 'Sehore to Ichhawar', routeType: '3' },
      { routeId: 'SHR005', routeShortName: '5', routeLongName: 'Sehore to Rehti', routeType: '3' },
    ],
    stops: [
      { stopId: 'SHR001', stopName: 'Sehore Bus Stand', stopLat: 23.2089, stopLon: 77.0823 },
      { stopId: 'SHR002', stopName: 'Sehore Naka', stopLat: 23.2123, stopLon: 77.0789 },
      { stopId: 'SHR003', stopName: 'Bhopal Road', stopLat: 23.2045, stopLon: 77.0912 },
      { stopId: 'SHR004', stopName: 'Ashta Road', stopLat: 23.1956, stopLon: 77.0734 },
      { stopId: 'SHR005', stopName: 'Shujalpur Road', stopLat: 23.2212, stopLon: 77.0956 },
      { stopId: 'SHR006', stopName: 'Ichhawar Road', stopLat: 23.1878, stopLon: 77.0678 },
      { stopId: 'SHR007', stopName: 'Rehti Road', stopLat: 23.2345, stopLon: 77.0890 },
      { stopId: 'SHR008', stopName: 'City Center', stopLat: 23.2067, stopLon: 77.0845 },
    ],
  },
};

/**
 * Get GTFS-like data for a city
 */
export function getCityGTFSData(cityName) {
  const city = cities[cityName.toLowerCase()];
  if (!city) {
    throw new Error(`City ${cityName} not found. Available cities: ${Object.keys(cities).join(', ')}`);
  }

  return {
    cityCode: city.code,
    lat: city.lat,
    lon: city.lon,
    routes: city.routes,
    stops: city.stops,
  };
}

/**
 * Get all cities GTFS data
 */
export function getAllCitiesGTFSData() {
  return cities;
}

/**
 * Get stops for a route
 */
export function getRouteStops(cityName, routeId) {
  const cityData = getCityGTFSData(cityName);
  const route = cityData.routes.find(r => r.routeId === routeId);
  
  if (!route) {
    return [];
  }

  // Return all stops (simplified - in real GTFS this would be based on stop_times)
  return cityData.stops;
}

/**
 * Get routes for a city
 */
export function getCityRoutes(cityName) {
  const cityData = getCityGTFSData(cityName);
  return cityData.routes;
}

/**
 * Get stops for a city
 */
export function getCityStops(cityName) {
  const cityData = getCityGTFSData(cityName);
  return cityData.stops;
}
