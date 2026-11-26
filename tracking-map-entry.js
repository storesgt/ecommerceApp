import 'leaflet.marker-motion';

let activeMap;
let activeVehicle;
let activeResizeObserver;
let resizeTimer;

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

const mapAreas = [
  { className: 'tracking-context-park', points: [[97, 8], [92, 23], [82, 25], [78, 16], [84, 5]] },
  { className: 'tracking-context-park', points: [[34, 72], [30, 84], [20, 87], [15, 77], [22, 68]] },
  { className: 'tracking-context-block', points: [[88, 63], [93, 67], [91, 73], [85, 72], [83, 67]] },
  { className: 'tracking-context-block', points: [[14, 33], [20, 31], [23, 37], [18, 42], [12, 39]] },
];
const mapIntersections = [[67, 55], [39, 55], [72, 34]];

const vehicleIcon = L.divIcon({
  className: 'tracking-vehicle-marker',
  html: '<span class="tracking-car-bubble"><svg viewBox="0 0 48 36" aria-hidden="true"><path class="tracking-car-body" d="M7 23.5h34l-3.1-9.2a4 4 0 0 0-3.8-2.7H13.9a4 4 0 0 0-3.8 2.7L7 23.5Z"/><path class="tracking-car-base" d="M4.5 21.5V29a3 3 0 0 0 3 3h2v-3h29v3h2a3 3 0 0 0 3-3v-7.5"/><path class="tracking-car-window" d="m13 14-2.2 6h26.4L35 14a1.8 1.8 0 0 0-1.7-1.2H14.7A1.8 1.8 0 0 0 13 14Z"/><circle class="tracking-car-wheel" cx="12" cy="29" r="3"/><circle class="tracking-car-wheel" cx="36" cy="29" r="3"/></svg></span>',
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

function destroyDeliveryRouteMap() {
  if (activeVehicle && !activeVehicle.isEnded()) activeVehicle.pause();
  activeResizeObserver?.disconnect();
  activeResizeObserver = undefined;
  window.clearTimeout(resizeTimer);
  resizeTimer = undefined;
  activeMap?.remove();
  activeVehicle = undefined;
  activeMap = undefined;
}

function renderDeliveryRouteMap(container, { progressIndex = 0 } = {}) {
  destroyDeliveryRouteMap();
  container.replaceChildren();

  const mapWidth = container.clientWidth || 360;
  const mapHeight = container.clientHeight || 300;
  const aspectRatio = mapHeight / mapWidth;
  const verticalFitScale = Math.max(0.22, (mapHeight - 164) / (mapWidth * 0.625));
  const verticalScale = Math.max(0.22, Math.min(1.25, aspectRatio, verticalFitScale));
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

  mapAreas.forEach(({ className, points }) => {
    L.polygon(points.map(toMapPoint), {
      className,
      fillOpacity: 0.8,
      interactive: false,
      stroke: false,
    }).addTo(map);
  });

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
  mapIntersections.forEach((point) => {
    L.circleMarker(toMapPoint(point), {
      className: 'tracking-context-junction',
      color: '#f8faf8',
      fillColor: '#f8faf8',
      fillOpacity: 1,
      interactive: false,
      radius: 3,
      weight: 2,
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
    className: 'tracking-route-surface',
    color: '#d9e0db',
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 1,
    weight: 8,
  }).addTo(map);
  L.polyline(mapRoutePoints, {
    className: 'tracking-route-centerline',
    color: '#9daaa1',
    dashArray: '4 7',
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
    const activeSegment = [mapRoutePoints[segmentStart], mapRoutePoints[segmentEnd]];
    L.polyline(activeSegment, {
      className: 'tracking-route-active-halo',
      color: brandColor,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 0.24,
      weight: 18,
    }).addTo(map);
    L.polyline(activeSegment, {
      className: 'tracking-route-active',
      color: brandColor,
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 1,
      weight: 8,
    }).addTo(map);
  }

  const routeBounds = L.latLngBounds(mapRoutePoints);
  const fitOptions = {
    animate: false,
    paddingBottomRight: [0, 32],
    paddingTopLeft: [0, 132],
  };
  map.fitBounds(routeBounds, fitOptions);

  /* All delivery stages shown as curated signposts, alternating sides to avoid road clutter. */
  const signposts = [
    { index: 0, label: 'Pending', icon: 'fa-clock', pos: 'right' },
    { index: 1, label: 'Confirmed', icon: 'fa-circle-check', pos: 'right' },
    { index: 2, label: 'Processing', icon: 'fa-gears', pos: 'left' },
    { index: 3, label: 'Packed', icon: 'fa-box', pos: 'right' },
    { index: 4, label: 'Shipped', icon: 'fa-truck-fast', pos: 'left' },
    { index: 5, label: 'Out for delivery', icon: 'fa-location-dot', pos: 'left' },
    { index: 6, label: 'Delivered', icon: 'fa-house', pos: 'left' },
  ];
  signposts.forEach(({ index, label, icon, pos }) => {
    const point = toMapPoint(routePoints[index]);
    const pointInContainer = map.latLngToContainerPoint(point);
    const sideOffset = -(32 + (index % 3) * 32);
    const signpostPoint = map.containerPointToLatLng([
      pointInContainer.x,
      pointInContainer.y + sideOffset,
    ]);
    const complete = index < targetIndex;
    const current = index === targetIndex;
    const upcoming = index > targetIndex;
    L.polyline([point, signpostPoint], {
      className: 'tracking-signpost-stem',
      color: brandColor,
      interactive: false,
      opacity: 0.8,
      weight: 2,
    }).addTo(map);
    L.circleMarker(point, {
      className: 'tracking-signpost-base',
      color: brandColor,
      fillColor: brandColor,
      fillOpacity: 1,
      interactive: false,
      radius: 3,
      weight: 2,
    }).addTo(map);
    L.marker(signpostPoint, {
      icon: L.divIcon({
        className: `tracking-signpost pos-${pos} ${complete ? 'is-complete' : ''} ${current ? 'is-current is-active' : ''} ${upcoming ? 'is-upcoming' : ''}`,
        html: `<span class="tracking-signpost-label"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span></span>`,
        iconSize: [140, 44],
        iconAnchor: pos === 'left' ? [140, 38] : [0, 38],
      }),
      interactive: false,
      zIndexOffset: current ? 900 : complete ? 500 : 200,
    }).addTo(map);
  });

  const motionPath = isDelivered
    ? [mapRoutePoints[targetIndex], mapRoutePoints[targetIndex]]
    : [mapRoutePoints[segmentStart], mapRoutePoints[segmentEnd], mapRoutePoints[segmentStart]];
  const vehicle = L.markerMotion(motionPath, 35, {
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

  requestAnimationFrame(() => {
    if (!container.isConnected) return;
    map.invalidateSize({ pan: false });
    requestAnimationFrame(() => {
      if (!container.isConnected) return;
      map.invalidateSize({ pan: false });
      map.fitBounds(routeBounds, fitOptions);
    });
  });
  if (typeof ResizeObserver === 'function') {
    let observedWidth = container.clientWidth;
    let observedHeight = container.clientHeight;
    activeResizeObserver = new ResizeObserver(([entry]) => {
      if (!container.isConnected) {
        activeResizeObserver?.disconnect();
        return;
      }
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (Math.abs(width - observedWidth) < 2 && Math.abs(height - observedHeight) < 2) return;
      observedWidth = width;
      observedHeight = height;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (container.isConnected) renderDeliveryRouteMap(container, { progressIndex: targetIndex });
      }, 120);
    });
    activeResizeObserver.observe(container);
  }
}

window.destroyDeliveryRouteMap = destroyDeliveryRouteMap;
window.renderDeliveryRouteMap = renderDeliveryRouteMap;
