import re

with open('frontend/app/components/DashboardMap.tsx', 'r') as f:
    content = f.read()

# 1. Update the base map to use Carto Vector GL style
content = re.sub(
    r"mapStyle=\{\{\s*version: 8 as const,[\s\S]*?\]\s*\}\}",
    "mapStyle={isDark ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}",
    content
)

# 2. Update heatmapLayer definition to be a beautiful smooth heatmap
new_heatmap_layer = """const heatmapLayer: LayerProps = {
  id: 'pm25-heat',
  type: 'heatmap',
  source: 'heatmap',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'pm25'], 0, 0, 400, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 3],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(34, 197, 94, 0)',
      0.2, 'rgba(163, 230, 53, 0.4)',
      0.4, 'rgba(250, 204, 21, 0.6)',
      0.6, 'rgba(249, 115, 22, 0.7)',
      0.8, 'rgba(239, 68, 68, 0.8)',
      1, 'rgba(124, 58, 237, 0.9)'
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 20, 10, 60],
    'heatmap-opacity': 0.8
  }
};"""

content = re.sub(
    r"const heatmapLayer: LayerProps = \{[\s\S]*?fill-outline-color.*?\n\s*\}\n\};",
    new_heatmap_layer,
    content
)

# 3. Change gridCells back to gridPoints (generating Point features for the heatmap)
new_grid = """const gridPoints: FeatureCollection<Point> = grid ? {
    type: 'FeatureCollection' as const,
    features: grid.lat.flatMap((lat, row) => grid.lon.map((lon, column) => ({
      type: 'Feature' as const,
      properties: { pm25: grid.values[row]?.[column] ?? 0 },
      geometry: { type: 'Point' as const, coordinates: [lon, lat] },
    })))
  } : { type: 'FeatureCollection' as const, features: [] };"""

content = re.sub(
    r"const gridCells: FeatureCollection<Polygon> = grid \? \{[\s\S]*?\{ type: 'FeatureCollection' as const, features: \[\] \};",
    new_grid,
    content
)

# 4. Change <Source id="heatmap" data={gridCells}> to <Source id="heatmap" data={gridPoints}>
content = content.replace("data={gridCells}", "data={gridPoints}")

# 5. Remove the complex MapLibre circle layers for fires, and replace with simple flame markers
fire_layer_code = """        {layersVisible.fires && fireClusters.map(cluster => (
          <Marker key={`fire-${cluster.cluster_id}`} longitude={cluster.centroid.lon} latitude={cluster.centroid.lat}>
            <div className="text-[1.4rem] leading-none drop-shadow-[0_0_12px_rgba(239,68,68,1)] hover:scale-125 transition-transform" title={`${cluster.fire_count} fires`}>🔥</div>
          </Marker>
        ))}"""

content = re.sub(
    r"\{\/\*\s*Fire cluster visual hotspots using MapLibre circles\s*\*\/\}[\s\S]*?<\/Source>\n\s*\)\}",
    fire_layer_code,
    content
)

# Ensure Point import is available
if 'type { FeatureCollection, LineString, Polygon }' in content:
    content = content.replace('type { FeatureCollection, LineString, Polygon }', 'type { FeatureCollection, LineString, Polygon, Point }')

with open('frontend/app/components/DashboardMap.tsx', 'w') as f:
    f.write(content)
