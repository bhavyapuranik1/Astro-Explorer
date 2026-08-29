import * as THREE from 'three';

/**
 * Centralized Label Policy Decision Engine
 * Decouples label visibility, symbol visibility, and 3D object rendering.
 *
 * @param {Object} object - Target object representation
 * @param {Object} context - Context ({ fov, isDaytime, activeSearchTarget, selectedObject })
 * @returns {Object} { showLabel, showSymbol, priority, markerType }
 */
export function getLabelPolicy(object, context = {}) {
  if (!object) return { showLabel: false, showSymbol: false, priority: 4, markerType: 'none' };

  const nameLower = (object.name || object.id || '').toLowerCase().trim();
  const searchLower = context.activeSearchTarget ? context.activeSearchTarget.toLowerCase().trim() : '';

  const selName = context.selectedObject ? (context.selectedObject.name || context.selectedObject.displayName || context.selectedObject.id || '').toLowerCase().trim() : '';

  const isSelected = object.isSelected || !!(selName && nameLower && (nameLower === selName || nameLower.includes(selName) || selName.includes(nameLower)));
  const isSearchTarget = !!(searchLower && nameLower && (nameLower === searchLower || nameLower.includes(searchLower) || searchLower.includes(nameLower)));

  // PRIORITY 0: Selected / Search Target / Picked object -> ALWAYS show label, symbol, and reticle
  if (isSelected || isSearchTarget) {
    return {
      showLabel: true,
      showSymbol: true,
      priority: 0,
      markerType: object.markerType || (object.type === 'dso' ? 'circle' : 'custom')
    };
  }

  const type = (object.type || '').toLowerCase();

  // COMETS: Hidden during bright daytime atmosphere
  if (type === 'comet' && context.isDaytime) {
    return { showLabel: false, showSymbol: false, priority: 3, markerType: 'none' };
  }

  // ASTEROIDS (Ceres, Vesta, Pallas, Bennu, Ryugu, Apophis, Didymos): Always type: 'asteroid', label & symbol ON
  if (type === 'asteroid') {
    return { showLabel: true, showSymbol: true, priority: 1, markerType: 'custom' };
  }

  // COMETS (Night or atmosphere off): Label & symbol ON
  if (type === 'comet') {
    return { showLabel: true, showSymbol: true, priority: 1, markerType: 'custom' };
  }

  // METEOR SHOWERS: Label & symbol ON
  if (type === 'meteor_shower') {
    return { showLabel: true, showSymbol: true, priority: 1, markerType: 'circle' };
  }

  // SATELLITES & SPACECRAFT: Label & symbol ON
  if (type === 'satellite' || type === 'spacecraft') {
    return { showLabel: true, showSymbol: true, priority: 1, markerType: 'custom' };
  }

  // PLANETS, SUN, MOON: Default label visible
  if (type === 'planet' || type === 'sun' || type === 'moon' || type === 'major_body') {
    return { showLabel: true, showSymbol: true, priority: 1, markerType: 'custom' };
  }

  // STARS:
  if (type === 'star') {
    const isMajorStar = object.priority <= 2 || (object.mag !== undefined && object.mag < 2.5);
    if (isMajorStar) {
      return { showLabel: true, showSymbol: true, priority: 2, markerType: 'custom' };
    }
    // Background stars: star point visible, text label hidden by default
    return { showLabel: false, showSymbol: true, priority: 4, markerType: 'custom' };
  }

  // DSOs:
  if (type === 'dso') {
    const isMessierOrFamous = object.priority <= 1 || (object.name && (object.name.startsWith('M') || object.name.toLowerCase().includes('messier')));
    if (isMessierOrFamous) {
      // Preserve existing rich astronomical symbols (M5, M3, M31, M42 etc.)
      return { showLabel: true, showSymbol: true, priority: 1, markerType: 'custom' };
    }
    // Background DSOs (e.g. Spindle, general catalog objects):
    // showLabel: FALSE by default. showSymbol: TRUE. markerType: 'circle' (clean ○ outline marker)
    return { showLabel: false, showSymbol: true, priority: 3, markerType: 'circle' };
  }

  // Fallback
  return {
    showLabel: object.priority <= 2,
    showSymbol: true,
    priority: object.priority !== undefined ? object.priority : 3,
    markerType: object.markerType || 'custom'
  };
}

export class LabelSystem {
  /**
   * @param {HTMLElement} container - Parent DOM element.
   */
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.labelsList = [];
    this.renderedLabelBoxes = [];
    this.activeSearchTarget = null;
    this.selectedObject = null;
    this.isDaytime = false;

    this.showDSOs = true;
    this.showStars = true;
    this.projectionMode = 'stereographic';
    this.showPlanets = true;
    this.showSatellites = true;
    this.showMeteors = false;

    this.init();
  }

  init() {
    if (!this.container) return;

    let overlay = this.container.querySelector('.sky-v2-label-overlay');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.className = 'sky-v2-label-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10';
      this.container.appendChild(overlay);
    }

    this.canvas = overlay;
    this.ctx = this.canvas.getContext('2d');

    this.resize();
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.canvas.width = w * (window.devicePixelRatio || 1);
    this.canvas.height = h * (window.devicePixelRatio || 1);
  }

  setLabels(items = []) {
    this.labelsList = items;
  }

  setSearchTarget(targetName) {
    this.activeSearchTarget = targetName ? String(targetName).toLowerCase().trim() : null;
  }

  setSelectedObject(obj) {
    this.selectedObject = obj || null;
  }

  setDaytime(isDay) {
    this.isDaytime = !!isDay;
  }

  setProjectionMode(mode) {
    this.projectionMode = (mode === 'stereographic' || mode === 'fisheye' || mode === 'planetarium') ? 'stereographic' : 'perspective';
  }

  /**
   * Renders labels overlay frame.
   * @param {THREE.Camera} camera
   * @param {THREE.Matrix4} [groupMatrix] - Optional world matrix of the rotating starSphereGroup.
   */
  render(camera, groupMatrix = null) {
    if (!this.canvas || !this.ctx || !camera) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;

    this.ctx.clearRect(0, 0, w, h);
    this.renderedLabelBoxes = [];

    const fov = camera.fov || 60;
    const projVector = new THREE.Vector3();
    const occupiedLabelBoxes = [];

    for (let i = 0; i < this.labelsList.length; i++) {
      const item = this.labelsList[i];
      if (!item || !item.position || !item.name) continue;

      const nameLower = (item.name || '').toLowerCase().trim();
      const searchLower = this.activeSearchTarget ? this.activeSearchTarget.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const selKeys = this.selectedObject ? [
        this.selectedObject.displayName,
        this.selectedObject.fullName,
        this.selectedObject.name,
        this.selectedObject.id,
        this.selectedObject.englishName
      ].filter(Boolean).map(s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')) : [];

      const cleanItemName = nameLower.replace(/[^a-z0-9]/g, '');

      const isTarget = !!(searchLower && cleanItemName && (cleanItemName === searchLower || cleanItemName.includes(searchLower) || searchLower.includes(cleanItemName)));
      const isSelectedObj = !!(item.isSelected || (selKeys.length > 0 && cleanItemName && selKeys.some(k => k === cleanItemName || cleanItemName.includes(k) || k.includes(cleanItemName))));

      const isSelectedOrTarget = isTarget || isSelectedObj;

      // Category toggle culling (e.g. DSO toggle OFF hides all DSO labels)
      if (item.type === 'dso' && !this.showDSOs && !isSelectedOrTarget) continue;
      if (item.type === 'star' && !this.showStars && !isSelectedOrTarget) continue;
      if (item.type === 'planet' && !this.showPlanets && !isSelectedOrTarget) continue;
      if (item.type === 'satellite' && !this.showSatellites && !isSelectedOrTarget) continue;
      if (item.type === 'meteor_shower' && !this.showMeteors && !isSelectedOrTarget) continue;

      const policy = getLabelPolicy(item, {
        fov,
        isDaytime: this.isDaytime,
        activeSearchTarget: this.activeSearchTarget,
        selectedObject: this.selectedObject
      });

      const showLabel = isSelectedOrTarget || policy.showLabel;
      const showSymbol = isSelectedOrTarget || policy.showSymbol;
      const markerType = item.markerType || policy.markerType;

      if (!showSymbol && !showLabel && !isSelectedOrTarget) continue;

      projVector.copy(item.position);
      if (groupMatrix && !item.isWorldPosition) {
        projVector.applyMatrix4(groupMatrix);
      }

      // Ground Horizon Label Culling disabled - all object labels render across full sky and landscape

      projVector.project(camera);

      // Clip objects behind camera
      if (projVector.z > 1.0) continue;

      const screenX = (projVector.x * 0.5 + 0.5) * w;
      const screenY = (-projVector.y * 0.5 + 0.5) * h;

      // Offscreen clipping
      if (screenX < 0 || screenX > w || screenY < 0 || screenY > h) continue;

      this.ctx.save();

      // Highlighted Cyan Reticle Halo ONLY for Searched / Selected Target
      if (isSelectedOrTarget) {
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2.0 * dpr;
        this.ctx.beginPath();
        const r = 12 * dpr;
        const len = 4 * dpr;
        this.ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        this.ctx.moveTo(screenX - r - len, screenY); this.ctx.lineTo(screenX - r + 2 * dpr, screenY);
        this.ctx.moveTo(screenX + r - 2 * dpr, screenY); this.ctx.lineTo(screenX + r + len, screenY);
        this.ctx.moveTo(screenX, screenY - r - len); this.ctx.lineTo(screenX, screenY - r + 2 * dpr);
        this.ctx.moveTo(screenX, screenY + r - 2 * dpr); this.ctx.lineTo(screenX, screenY + r + len);
        this.ctx.stroke();
      }

      // Draw Circular Marker (○) for background DSOs without custom symbols
      if (showSymbol && markerType === 'circle' && !isSelectedOrTarget) {
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 4 * dpr, 0, Math.PI * 2);
        this.ctx.strokeStyle = item.color || '#b8c7d9';
        this.ctx.lineWidth = 1.3 * dpr;
        this.ctx.stroke();
      }

      // If text label is suppressed by policy, record generous bounding box (24px hit radius) for click picking and continue
      if (!showLabel) {
        const hitR = 24 * dpr;
        this.renderedLabelBoxes.push({
          objectId: item.id || item.name,
          name: item.name,
          type: item.type,
          item: item,
          rawObj: item.rawObj || item,
          position: projVector.clone(),
          priority: item.priority !== undefined ? item.priority : 3,
          visible: true,
          minX: (screenX - hitR) / dpr,
          maxX: (screenX + hitR) / dpr,
          minY: (screenY - hitR) / dpr,
          maxY: (screenY + hitR) / dpr
        });
        this.ctx.restore();
        continue;
      }

      // Configure font style
      if (isSelectedOrTarget) {
        this.ctx.fillStyle = '#00ffff';
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 10 * dpr;
        this.ctx.font = `bold ${Math.round(14 * dpr)}px sans-serif`;
      } else {
        this.ctx.fillStyle = item.color || '#ffffff';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 4 * dpr;
        this.ctx.font = `${Math.round(11 * dpr)}px sans-serif`;
      }

      const isSunLabel = item.name === 'Sun' || item.type === 'sun' || item.isSun;

      if (isSunLabel) {
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.font = `bold ${Math.round(15 * dpr)}px sans-serif`;
      } else {
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
      }

      // Collision avoidance check for text labels
      const textWidth = this.ctx.measureText(item.name).width;
      const offsetX = isSunLabel ? -22 : (isSelectedOrTarget ? 15 : 7);
      const offsetY = isSunLabel ? -22 : 0;
      const labelMinX = screenX + offsetX * dpr;
      const labelMaxX = labelMinX + textWidth;
      const labelMinY = screenY + (offsetY - 8) * dpr;
      const labelMaxY = screenY + (offsetY + 8) * dpr;

      let collides = false;
      if (!isTarget && !item.isSelected && item.priority > 0) {
        for (let j = 0; j < occupiedLabelBoxes.length; j++) {
          const b = occupiedLabelBoxes[j];
          if (
            labelMinX < b.maxX &&
            labelMaxX > b.minX &&
            labelMinY < b.maxY &&
            labelMaxY > b.minY
          ) {
            collides = true;
            break;
          }
        }
      }

      if (!collides) {
        // Stellarium Leader Line for Selected/Targeted items
        if (isSelectedOrTarget) {
          this.ctx.beginPath();
          this.ctx.moveTo(screenX + 8 * dpr, screenY);
          this.ctx.lineTo(screenX + 12 * dpr, screenY);
          this.ctx.strokeStyle = '#00ffff';
          this.ctx.lineWidth = 1.5 * dpr;
          this.ctx.stroke();
        } else if (showSymbol && markerType === 'circle') {
          this.ctx.beginPath();
          this.ctx.moveTo(screenX + 3 * dpr, screenY);
          this.ctx.lineTo(screenX + 5 * dpr, screenY);
          this.ctx.strokeStyle = item.color || 'rgba(255, 255, 255, 0.4)';
          this.ctx.lineWidth = 1.0 * dpr;
          this.ctx.stroke();
        }

        // Outline stroke for contrast
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.lineWidth = 3.0 * dpr;
        const drawX = labelMinX;
        const drawY = screenY + offsetY * dpr;
        this.ctx.strokeText(item.name, drawX, drawY);
        this.ctx.fillText(item.name, drawX, drawY);

        occupiedLabelBoxes.push({
          minX: labelMinX,
          maxX: labelMaxX,
          minY: labelMinY,
          maxY: labelMaxY
        });
      }

      this.renderedLabelBoxes.push({
        objectId: item.id || item.name,
        name: item.name,
        type: item.type,
        item: item,
        rawObj: item.rawObj || item,
        position: projVector.clone(),
        priority: item.priority !== undefined ? item.priority : 1,
        visible: true,
        minX: (screenX - 12 * dpr) / dpr,
        maxX: (screenX + (20 * dpr + textWidth)) / dpr,
        minY: (screenY - 16 * dpr) / dpr,
        maxY: (screenY + 16 * dpr) / dpr
      });

      this.ctx.restore();
    }

    this.renderCardinalPoints(camera, w, h, dpr);
  }

  renderCardinalPoints(camera, w, h, dpr) {
    if (!camera) return;

    const cardinals = [
      { name: 'N', az: 0 },
      { name: 'E', az: 90 },
      { name: 'S', az: 180 },
      { name: 'W', az: 270 }
    ];

    // Planetarium Dome Compass Ring (North=Top, South=Bottom, East=Right, West=Left)
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const camAz = Math.atan2(camDir.x, -camDir.z);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const margin = 52 * dpr;
    const radiusX = Math.max(80 * dpr, (w * 0.5) - margin);
    const radiusY = Math.max(80 * dpr, (h * 0.5) - margin);

    for (let i = 0; i < cardinals.length; i++) {
      const c = cardinals[i];
      const azRad = THREE.MathUtils.degToRad(c.az);
      const relAngle = azRad - camAz;

      const screenX = cx + Math.sin(relAngle) * radiusX;
      const screenY = cy - Math.cos(relAngle) * radiusY;

      this.drawRedCardinalBadge(c.name, screenX, screenY, dpr);
    }
  }

  drawRedCardinalBadge(name, screenX, screenY, dpr) {
    this.ctx.save();
    const boxSize = 22 * dpr;
    const boxR = 4 * dpr;
    const boxX = screenX - boxSize * 0.5;
    const boxY = screenY - boxSize * 0.5;

    this.ctx.fillStyle = 'rgba(215, 38, 38, 0.92)';
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.lineWidth = 1.5 * dpr;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 6 * dpr;

    this.ctx.beginPath();
    if (typeof this.ctx.roundRect === 'function') {
      this.ctx.roundRect(boxX, boxY, boxSize, boxSize, boxR);
    } else {
      this.ctx.rect(boxX, boxY, boxSize, boxSize);
    }
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;

    this.ctx.font = `bold ${Math.round(14 * dpr)}px sans-serif`;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(name, screenX, screenY + 0.5 * dpr);

    this.ctx.restore();
  }

  dispose() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }
  }
}

export default LabelSystem;
