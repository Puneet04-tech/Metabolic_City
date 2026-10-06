import h3 from 'h3-js';

// Check where these H3 indices are located
const h3Indices = [
  '883d902c87fffff',
  '883d902ca7fffff',
  '883d902cabfffff',
  '883d902cb5fffff',
  '883d902cb9fffff',
];

console.log('H3 Index Locations:');
h3Indices.forEach(h3Index => {
  const [lat, lon] = h3.cellToLatLng(h3Index);
  console.log(`  ${h3Index}: Lat ${lat}, Lon ${lon}`);
});
