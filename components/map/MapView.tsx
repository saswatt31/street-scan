'use client';
import { useEffect, useRef } from 'react';
import type { Report } from '@/lib/supabase';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#34d399', medium: '#fbbf24', high: '#f97316', critical: '#ef4444',
};

interface Props {
  reports: Report[];
  selected: Report | null;
  onSelect: (r: Report) => void;
}

export default function MapView({ reports, selected, onSelect }: Props) {
  const mapRef  = useRef<any>(null);
  const divRef  = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return;

    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    const map = L.map(divRef.current!, {
      center: [20.2961, 85.8245],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const L = require('leaflet');

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    reports.forEach(report => {
      const color = SEVERITY_COLORS[report.severity] ?? '#f97316';
      const size  = report.severity === 'critical' ? 18 : report.severity === 'high' ? 15 : 12;

      const icon = L.divIcon({
        html: `<div style="
          width:${size}px; height:${size}px;
          border-radius:50%;
          background:${color};
          border:2px solid rgba(255,255,255,0.4);
          box-shadow:0 0 0 4px ${color}30, 0 0 12px ${color}60;
          cursor:pointer;
          ${report.severity === 'critical' ? 'animation: markerPulse 2s ease-in-out infinite;' : ''}
        "></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const m = L.marker([report.latitude, report.longitude], { icon })
        .addTo(mapRef.current)
        .on('click', () => onSelect(report));

      markersRef.current.push(m);
    });

    if (markersRef.current.length > 0) {
      try {
        const group = L.featureGroup(markersRef.current);
        mapRef.current.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 });
      } catch (e) {
        console.warn('Could not fit bounds on map', e);
      }
    }
  }, [reports, onSelect]);

  useEffect(() => {
    if (selected && mapRef.current) {
      mapRef.current.setView([selected.latitude, selected.longitude], 15, { animate: true });
    }
  }, [selected]);

  return <div ref={divRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />;
}
