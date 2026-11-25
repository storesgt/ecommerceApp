import 'leaflet.marker-motion';

let activeMap;
let activeVehicle;

const routePoints = [
  [82, 2],
  [70, 17],
  [73, 33],
  [55, 49],
  [57, 66],
  [39, 82],
  [22, 98],
];

const roadLines = [
  [[99, 12], [80, 16], [61, 10], [43, 19], [23, 15], [2, 28]],
  [[97, 77], [78, 70], [63, 81], [45, 76], [26, 88], [3, 83]],
  [[89, 98], [75, 76], [67, 55], [72, 34], [60, 2]],
  [[18, 98], [31, 74], [25, 55], [39, 38], [33, 2]],
  [[1, 51], [21, 48], [39, 55], [57, 50], [79, 57], [99, 48]],
];

const makePointIcon = (className) => L.divIcon({
  className,
  html: '<span aria-hidden="true"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const vehicleIcon = L.divIcon({
  className: 'tracking-vehicle-marker',
  html: '<span class="tracking-car-bubble"><svg viewBox="0 0 48 36" aria-hidden="true"><path class="tracking-car-body" d="M7 23.5h34l-3.1-9.2a4 4 0 0 0-3.8-2.7H13.9a4 4 0 0 0-3.8 2.7L7 23.5Z"/><path class="tracking-car-base" d="M4.5 21.5V29a3 3 0 0 0 3 3h2v-3h29v3h2a3 3 0 0 0 3-3v-7.5"/><path class="tracking-car-window" d="m13 14-2.2 6h26.4L35 14a1.8 1.8 0 0 0-1.7-1.2H14.7A1.8 1.8 0 0 0 13 14Z"/><circle class="tracking-car-wheel" cx="12" cy="29" r="3"/><circle class="tracking-car-wheel" cx="36" cy="29" r="3"/></svg></span>',
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

function destroyDeliveryRouteMap() {
  if (activeVehicle && !activeVehicle.isEnded()) activeVehicle.pause();
  activeMap?.remove();
  activeVehicle = undefined;
  activeMap = undefined;
}

function renderDeliveryRouteMap(container, { progressIndex = 0 } = {}) {
  destroyDeliveryRouteMap();
  container.replaceChildren();

  const aspectRatio = container.clientWidth > 0 && container.clientHeight > 0
    ? container.clientHeight / container.clientWidth
    : 0.45;
  const verticalScale = Math.max(0.35, Math.min(1.25, aspectRatio));
  const toMapPoint = ([latitude, longitude]) => [latitude / 10000 * verticalScale, longitude / 10000];
  const mapRoutePoints = routePoints.map(toMapPoint);
  const map = L.map(container, {
    attributionControl: false,
    boxZoom: false,
    doubleClickZoom: false,
    dragging: false,
    keyboard: false,
    scrollWheelZoom: false,
    touchZoom: false,
    zoomControl: false,
    crs: L.CRS.Simple,
  });
  activeMap = map;

  roadLines.forEach((road) => {
    L.polyline(road.map(toMapPoint), {
      className: 'tracking-road-surface',
      color: '#d9e0db',
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0.8,
      weight: 14,
    }).addTo(map);
    L.polyline(road.map(toMapPoint), {
      className: 'tracking-road-center',
      color: '#f8faf8',
      dashArray: '2 7',
      lineCap: 'round',
      opacity: 0.9,
      weight: 3,
    }).addTo(map);
  });

  L.polyline(mapRoutePoints, {
    className: 'tracking-route-base',
    color: '#fff',
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 0.95,
    weight: 12,
  }).addTo(map);
  L.polyline(mapRoutePoints, {
    className: 'tracking-route-centerline',
    color: '#9daaa1',
    dashArray: '3 8',
    lineCap: 'round',
    opacity: 0.9,
    weight: 4,
  }).addTo(map);

  const targetIndex = Math.max(0, Math.min(routePoints.length - 1, Number.isInteger(progressIndex) ? progressIndex : 0));
  const isDelivered = targetIndex === routePoints.length - 1;
  const segmentStart = isDelivered ? targetIndex : Math.max(0, targetIndex - 1);
  const segmentEnd = isDelivered ? targetIndex : Math.min(targetIndex + (targetIndex === 0 ? 1 : 0), routePoints.length - 1);
  const brandColor = getComputedStyle(container).getPropertyValue('--brand-primary').trim() || '#76864a';
  if (targetIndex > 0) {
    L.polyline(mapRoutePoints.slice(0, targetIndex + 1), {
      className: 'tracking-route-progress',
      color: brandColor,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0.95,
      weight: 8,
    }).addTo(map);
  }
  if (!isDelivered) {
    L.polyline([mapRoutePoints[segmentStart], mapRoutePoints[segmentEnd]], {
      className: 'tracking-route-active',
      color: brandColor,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 1,
      weight: 8,
    }).addTo(map);
  }

  L.marker(mapRoutePoints[0], { icon: makePointIcon('tracking-origin-marker'), interactive: false }).addTo(map);
  L.marker(mapRoutePoints[mapRoutePoints.length - 1], { icon: makePointIcon('tracking-destination-marker'), interactive: false }).addTo(map);

  [routePoints[2], routePoints[4]].forEach((point) => {
    L.marker(toMapPoint(point), {
      icon: L.divIcon({
        className: 'tracking-route-arrow',
        html: '<span aria-hidden="true">›</span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      interactive: false,
    }).addTo(map);
  });

  const motionPath = isDelivered
    ? [mapRoutePoints[targetIndex], mapRoutePoints[targetIndex]]
    : [mapRoutePoints[segmentStart], mapRoutePoints[segmentEnd], mapRoutePoints[segmentStart]];
  const vehicle = L.markerMotion(motionPath, 300, {
    autoplay: false,
    icon: vehicleIcon,
    loop: !isDelivered,
    rotation: true,
  }).addTo(map);
  activeVehicle = vehicle;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || isDelivered) {
    vehicle.setLatLng(mapRoutePoints[targetIndex]);
  } else {
    vehicle.start();
  }

  const routeBounds = L.latLngBounds([0, 0], [0.01 * verticalScale, 0.01]);
  map.fitBounds(routeBounds, { animate: false, padding: [4, 4] });
  requestAnimationFrame(() => {
    if (!container.isConnected) return;
    map.invalidateSize({ pan: false });
    requestAnimationFrame(() => {
      if (!container.isConnected) return;
      map.invalidateSize({ pan: false });
      map.fitBounds(routeBounds, { animate: false, padding: [4, 4] });
    });
  });
}

window.destroyDeliveryRouteMap = destroyDeliveryRouteMap;
window.renderDeliveryRouteMap = renderDeliveryRouteMap;
