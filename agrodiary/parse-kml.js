const fs = require('fs');
const path = require('path');

const kml = fs.readFileSync(path.join(__dirname, '..', 'kmz_extract', 'doc.kml'), 'utf8');

const result = { parcelas: [], variedades: [], pozos: [], reservorios: [] };

// Parse polygon placemarks for sectors
const sectorPattern = /<Placemark>\s*<name>(Sector \d+|Airen Sector \d+|Pistachos\d?\s*\d+HA)<\/name>[\s\S]*?<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
let m;
while ((m = sectorPattern.exec(kml)) !== null) {
  const name = m[1];
  const coords = m[2].trim().split(/\s+/).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));
  result.parcelas.push({ name, coordinates: coords });
}

// Parse variety polygons
const varNames = ['Tempranillo Abajo', 'Tempranillo Arriba', 'Cabernet Arriba', 'Cabernet Abajo', 'Airen', 'Pistachos', 'Pistachos Monte', 'Sauvignon Blanc', 'Sauvignon Blanc 2024'];
const varPattern = /<Placemark>\s*<name>([^<]+)<\/name>[\s\S]*?<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
while ((m = varPattern.exec(kml)) !== null) {
  const name = m[1].trim();
  if (varNames.includes(name)) {
    const coords = m[2].trim().split(/\s+/).map(c => {
      const [lng, lat] = c.split(',').map(Number);
      return { lat, lng };
    }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));
    result.variedades.push({ name, coordinates: coords });
  }
}

// Parse wells (points)
const pozoPattern = /<Placemark>\s*<name>(Pozo[^<]+)<\/name>[\s\S]*?<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
while ((m = pozoPattern.exec(kml)) !== null) {
  const [lng, lat] = m[2].trim().split(',').map(Number);
  if (!isNaN(lat) && !isNaN(lng)) result.pozos.push({ name: m[1].trim(), lat, lng });
}

// Parse reservoirs (points)
const resPattern = /<Placemark>\s*<name>(Reservorio[^<]+)<\/name>[\s\S]*?<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
while ((m = resPattern.exec(kml)) !== null) {
  const [lng, lat] = m[2].trim().split(',').map(Number);
  if (!isNaN(lat) && !isNaN(lng)) result.reservorios.push({ name: m[1].trim(), lat, lng });
}

console.log(`Parcelas: ${result.parcelas.length}`);
console.log(`Variedades: ${result.variedades.length}`);
console.log(`Pozos: ${result.pozos.length}`);
console.log(`Reservorios: ${result.reservorios.length}`);

fs.writeFileSync(path.join(__dirname, 'public', 'data', 'farm-map.json'), JSON.stringify(result, null, 2));
console.log('farm-map.json created!');
