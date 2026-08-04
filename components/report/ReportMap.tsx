'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Report } from '@/lib/report/types';

const WALK_RADIUS_M = 800;

/** GeoJSON circle approximating a walking radius. */
function circle(lat: number, lon: number, radiusM: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const latRadius = radiusM / 110_574;
  const lonRadius = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([lon + lonRadius * Math.cos(angle), lat + latRadius * Math.sin(angle)]);
  }

  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
    properties: {},
  };
}

export function ReportMap({ report }: { report: Report }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN;
    if (!container.current || !token) return;

    mapboxgl.accessToken = token;
    const { lat, lon } = report.coordinates;

    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [lon, lat],
      zoom: 14,
    });

    map.on('load', () => {
      map.addSource('walk-radius', { type: 'geojson', data: circle(lat, lon, WALK_RADIUS_M) });
      map.addLayer({
        id: 'walk-radius-fill',
        type: 'fill',
        source: 'walk-radius',
        paint: { 'fill-color': '#ff4f00', 'fill-opacity': 0.07 },
      });
      map.addLayer({
        id: 'walk-radius-line',
        type: 'line',
        source: 'walk-radius',
        paint: { 'line-color': '#ff4f00', 'line-width': 1.5, 'line-dasharray': [3, 2] },
      });

      for (const amenity of report.amenities.filter((a) => a.distanceM <= WALK_RADIUS_M)) {
        const dot = document.createElement('div');
        dot.style.cssText =
          'width:8px;height:8px;border-radius:50%;background:#4b5563;border:1.5px solid #fff';
        new mapboxgl.Marker(dot)
          .setLngLat([amenity.lon, amenity.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(amenity.name))
          .addTo(map);
      }

      const pin = document.createElement('div');
      pin.style.cssText =
        'width:20px;height:20px;border-radius:50%;background:#ff4f00;border:3px solid #fff;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.3)';
      new mapboxgl.Marker(pin).setLngLat([lon, lat]).addTo(map);
    });

    return () => map.remove();
  }, [report]);

  return (
    <div
      ref={container}
      aria-label={`Map of ${report.address} with nearby amenities`}
      role="img"
      className="h-[420px] w-full overflow-hidden rounded-card border border-gray-4 bg-gray-5"
    />
  );
}
