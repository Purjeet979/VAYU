/* eslint-disable @typescript-eslint/no-explicit-any */
export interface GridData {
  lon: number[];
  lat: number[];
  values: (number | null)[][];
}

// --- Ray Casting Algorithm for Point in Polygon ---
function pointInPolygon(point: [number, number], vs: [number, number][]) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeoJSONFeature(lon: number, lat: number, geometry: any) {
  const pt: [number, number] = [lon, lat];
  if (geometry.type === 'Polygon') {
    return pointInPolygon(pt, geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInPolygon(pt, poly[0])) return true;
    }
  }
  return false;
}

export function computeChoropleth(geo: any, gridData: GridData | null) {
  if (!geo || !gridData?.values) return null;
  const newGeo = JSON.parse(JSON.stringify(geo)); // deep copy
  for (const feature of newGeo.features) {
    let sum = 0;
    let count = 0;
    let minD = Infinity;
    let nearestVal: number | null = null;
    
    // Find polygon centroid roughly for fallback
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    const updateBounds = (pts: any[]) => pts.forEach((p:any) => {
      minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]);
      minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]);
    });
    if (feature.geometry.type === 'Polygon') updateBounds(feature.geometry.coordinates[0]);
    else if (feature.geometry.type === 'MultiPolygon') feature.geometry.coordinates.forEach((poly:any) => updateBounds(poly[0]));
    const cx = (minLon + maxLon)/2, cy = (minLat + maxLat)/2;

    for (let i = 0; i < gridData.lat.length; i++) {
      for (let j = 0; j < gridData.lon.length; j++) {
        const val = gridData.values[i]?.[j];
        if (typeof val === 'number' && !Number.isNaN(val)) {
          const lat = gridData.lat[i], lon = gridData.lon[j];
          
          if (pointInGeoJSONFeature(lon, lat, feature.geometry)) {
            sum += val;
            count++;
          }
          const d = Math.hypot(lat - cy, lon - cx);
          if (d < minD) { minD = d; nearestVal = val; }
        }
      }
    }
    feature.properties.value = count > 0 ? (sum / count) : (minD < 0.5 && nearestVal !== null ? nearestVal : null);
  }
  return newGeo;
}
