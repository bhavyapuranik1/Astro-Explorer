/**
 * PickingSystem - Dedicated Object Picking & Hit Testing Module for SkyRendererV2
 * 
 * Manages 5-level screen-space picking, label-box hit tests, and strict visibility rules.
 */

import * as THREE from 'three';

export class PickingSystem {
  /**
   * @param {Object} skyRenderer - Instance of SkyRendererV2.
   */
  constructor(skyRenderer) {
    this.skyRenderer = skyRenderer;
    this._pickingCandidates = [];
    this._tempProjVector = new THREE.Vector3();
    this._tempLocalPosVector = new THREE.Vector3();
  }

  /**
   * Checks if an object is strictly visible and clickable on screen.
   * @param {Object} obj - Target object.
   * @param {string} [fallbackType=''] - Fallback object category type.
   * @returns {boolean}
   */
  isObjectVisible(obj, fallbackType = '') {
    if (!obj || !this.skyRenderer) return false;

    let typeLower = String(obj.type || fallbackType || '').toLowerCase();
    const dsoSubtypes = ['dso', 'oc', 'gc', 'g', 'pn', 'sfr', 'rn', 'e', 's', 'snr', 'pos', 'i', 'ngc', 'ic', 'messier', 'open cluster', 'globular cluster', 'planetary nebula', 'galaxy', 'nebula', 'cluster'];
    if (dsoSubtypes.includes(typeLower)) {
      typeLower = 'dso';
    }

    // 1. Searched target exemption: searched object is ALWAYS visible and clickable
    const targetName = this.skyRenderer.selectedTargetObject ? String(this.skyRenderer.selectedTargetObject.displayName || this.skyRenderer.selectedTargetObject.name || this.skyRenderer.selectedTargetObject.id || '').toLowerCase() : null;
    const objName = String(obj.displayName || obj.name || obj.id || '').toLowerCase();
    const isSearchTarget = targetName && (targetName === objName || (objName && objName.includes(targetName)) || (targetName && targetName.includes(objName)));

    if (isSearchTarget) return true;

    // Daytime + Atmosphere ON: ONLY Planets, Sun, Moon are selectable!
    const sunAlt = (this.skyRenderer.atmosphere && this.skyRenderer.atmosphere.sunAltitude !== undefined)
      ? this.skyRenderer.atmosphere.sunAltitude
      : -30;
    const isDaytimeAtmosphereOn = !!(this.skyRenderer.showAtmosphere !== false && sunAlt > 0);

    if (isDaytimeAtmosphereOn && typeLower !== 'planet' && typeLower !== 'sun' && typeLower !== 'moon') {
      return false;
    }

    // 3. Planets, Sun, Moon
    if (typeLower === 'planet' || typeLower === 'sun' || typeLower === 'moon') {
      if (this.skyRenderer.showPlanets === false) return false;
      return true;
    }

    // 4. Stars (Clickable whenever showStars is enabled and within magnitude limit)
    if (typeLower === 'star') {
      if (this.skyRenderer.showStars === false) return false;
      let mag = parseFloat(obj.mag);
      if (isNaN(mag) && obj.rawObj) mag = parseFloat(obj.rawObj.mag);
      const limit = parseFloat(this.skyRenderer.starMagnitudeLimit) || 6.5;
      if (!isNaN(mag) && mag > limit) return false;
      return true;
    }

    // 5. Deep Sky Objects (DSOs) (Clickable whenever showDSOs is enabled)
    if (typeLower === 'dso') {
      if (this.skyRenderer.showDSOs === false) return false;
      if (obj.isVisible === false || obj.visible === false) return false;
      if (obj.currentOpacity !== undefined && Number(obj.currentOpacity) <= 0.15) return false;
      if (obj.opacity !== undefined && Number(obj.opacity) <= 0.15) return false;
      if (obj.rawObj) {
        if (obj.rawObj.isVisible === false || obj.rawObj.visible === false) return false;
        if (obj.rawObj.currentOpacity !== undefined && Number(obj.rawObj.currentOpacity) <= 0.15) return false;
      }
      return true;
    }

    // 6. Satellites & Spacecraft
    if (typeLower === 'satellite' || typeLower === 'spacecraft') {
      const showFlag = typeLower === 'satellite' ? this.skyRenderer.showSatellites : this.skyRenderer.showSpacecraft;
      if (showFlag === false) return false;
      if (obj.isVisible === false || (obj.currentOpacity !== undefined && obj.currentOpacity < 0.15)) return false;
      if (obj.rawObj && (obj.rawObj.isVisible === false || (obj.rawObj.currentOpacity !== undefined && obj.rawObj.currentOpacity < 0.15))) return false;
      return true;
    }

    // 7. Constellations & Asterisms (Strictly visual-only, UNCLICKABLE)
    if (typeLower === 'constellation' || typeLower === 'asterism') {
      return false;
    }

    // 8. Asteroids & Comets
    if (typeLower === 'asteroid') {
      return this.skyRenderer.showAsteroids !== false;
    }

    if (typeLower === 'comet') {
      return this.skyRenderer.showComets !== false;
    }

    return true;
  }

  /**
   * Performs 5-level screen-space picking with zero per-click allocations.
   * @param {number} clientX 
   * @param {number} clientY 
   * @returns {Object|null}
   */
  pickObject(clientX, clientY) {
    const sr = this.skyRenderer;
    if (!sr || !sr.container || !sr.camera) return null;

    const rect = sr.container.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    this._pickingCandidates = [];

    const fov = sr.camera.fov || 60;
    const isZoomedOut = fov >= 55;
    const isMediumZoom = fov >= 25 && fov < 55;

    const searchObjects = (typeof window !== 'undefined' && Array.isArray(window.searchObjects))
      ? window.searchObjects
      : [];

    // STEP 0: Label-First Hit Test (Generous 20px padding + normalized key lookup)
    const LABEL_HIT_PADDING = 20;
    if (sr.labelSystem && Array.isArray(sr.labelSystem.renderedLabelBoxes)) {
      const boxes = sr.labelSystem.renderedLabelBoxes;
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (!box || !box.name || box.visible === false || box.type === 'constellation' || box.type === 'asterism') continue;

        if (mouseX >= box.minX - LABEL_HIT_PADDING && mouseX <= box.maxX + LABEL_HIT_PADDING &&
            mouseY >= box.minY - LABEL_HIT_PADDING && mouseY <= box.maxY + LABEL_HIT_PADDING) {

          const boxKey = String(box.objectId || box.name).toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
          const baseObj = box.item || box.rawObj || catalogMatch;
          if (!baseObj) continue;

          const boxCenterX = (box.minX + box.maxX) * 0.5;
          const boxCenterY = (box.minY + box.maxY) * 0.5;
          const dx = mouseX - boxCenterX;
          const dy = mouseY - boxCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          this._pickingCandidates.push({
            obj: baseObj,
            dist: dist,
            radius: Math.max(30, (box.maxX - box.minX) * 0.5),
            score: dist * 0.2,
            tier: 1,
            isLabelHit: true
          });
        }
      }
    }

    // Helper to evaluate candidate objects
    const evaluateCandidate = (obj, categoryType, fallbackRadius) => {
      if (!obj) return;
      let typeLower = String(obj.type || categoryType || '').toLowerCase();
      const dsoSubtypes = ['dso', 'oc', 'gc', 'g', 'pn', 'sfr', 'rn', 'e', 's', 'snr', 'pos', 'i', 'ngc', 'ic', 'messier', 'open cluster', 'globular cluster', 'planetary nebula', 'galaxy', 'nebula', 'cluster'];
      if (dsoSubtypes.includes(typeLower)) {
        typeLower = 'dso';
      }

      if (typeLower === 'constellation' || typeLower === 'asterism') return;
      if (!this.isObjectVisible(obj, categoryType)) return;

      const wPos = sr.getObjectWorldPosition(obj);
      if (!wPos) return;

      this._tempProjVector.copy(wPos).project(sr.camera);
      if (this._tempProjVector.z > 1.0) return;

      const screenX = (this._tempProjVector.x * 0.5 + 0.5) * rect.width + rect.left;
      const screenY = (-this._tempProjVector.y * 0.5 + 0.5) * rect.height + rect.top;

      const dx = clientX - screenX;
      const dy = clientY - screenY;
      const distSq = dx * dx + dy * dy;

      let radius = fallbackRadius;
      let tier = 5;

      if (typeLower === 'planet' || typeLower === 'sun' || typeLower === 'moon') {
        radius = isZoomedOut ? 36 : (isMediumZoom ? 44 : 52);
        tier = 1;
      } else if (typeLower === 'dso') {
        const dsoKey = String(obj.id || obj.name || '').toLowerCase();
        const isMajorDSO = dsoKey.startsWith('m') || dsoKey.includes('messier') || dsoKey.includes('ngc') || dsoKey.includes('ic');
        radius = isMajorDSO ? (isZoomedOut ? 42 : (isMediumZoom ? 50 : 60)) : (isZoomedOut ? 32 : (isMediumZoom ? 38 : 46));
        tier = 2;
      } else if (typeLower === 'spacecraft' || typeLower === 'satellite') {
        radius = isZoomedOut ? 28 : (isMediumZoom ? 34 : 40);
        tier = 3;
      } else if (typeLower === 'asteroid' || typeLower === 'comet') {
        radius = isZoomedOut ? 24 : (isMediumZoom ? 28 : 34);
        tier = 4;
      } else if (typeLower === 'star') {
        const mag = parseFloat(obj.mag);
        const isBrightStar = !isNaN(mag) && mag <= 2.0;
        radius = isBrightStar ? (isZoomedOut ? 28 : (isMediumZoom ? 34 : 40)) : (isZoomedOut ? 22 : (isMediumZoom ? 26 : 32));
        tier = 5;
      }

      const radiusSq = radius * radius;
      // Also allow label-offset click hit testing (label is positioned +10px to +80px to the right of symbol)
      const isLabelOffsetHit = (typeLower === 'dso' || typeLower === 'star' || typeLower === 'planet') &&
                               (dx >= -15 && dx <= 90 && Math.abs(dy) <= 22);

      if (distSq <= radiusSq || isLabelOffsetHit) {
        const dist = Math.sqrt(distSq);
        let score = dist / radius;
        if (dist <= 6.0) score -= 0.4;
        if (isLabelOffsetHit) score -= 0.3;

        this._pickingCandidates.push({
          obj,
          dist,
          radius,
          score,
          tier,
          isLabelHit: false
        });
      }
    };

    // 1. Evaluate searchObjects array
    for (let i = 0; i < searchObjects.length; i++) {
      const obj = searchObjects[i];
      if (!obj || !obj.type) continue;
      // DSOs are picked exclusively from DSORenderingSystem's canonical list.
// This prevents duplicate/stale search entries such as NGC 2244/NGC 2246
// from competing for the same screen-space click.
const normalizedType = String(obj.type || '').toLowerCase();

if (
    normalizedType !== 'dso' &&
    normalizedType !== 'ngc' &&
    normalizedType !== 'ic' &&
    normalizedType !== 'messier' &&
    normalizedType !== 'galaxy' &&
    normalizedType !== 'nebula' &&
    normalizedType !== 'cluster' &&
    normalizedType !== 'pn' &&
    normalizedType !== 'snr' &&
    normalizedType !== 'oc' &&
    normalizedType !== 'gc'
) {
    evaluateCandidate(obj, obj.type, 30);
}
    }

    // 2. Evaluate DSOs catalog fallback
    if (sr.showDSOs !== false && sr.dsoRenderingSystem && Array.isArray(sr.dsoRenderingSystem.dsoList)) {
      const sphereRadius = sr.options.sphereRadius * 0.995;
      const dsoList = sr.dsoRenderingSystem.dsoList;
      for (let i = 0; i < dsoList.length; i++) {
        const dso = dsoList[i];
        if (!dso) continue;
        const raDeg = sr.parseCelestialRA(dso.ra);
        const decDeg = sr.parseCelestialDec(dso.dec);
        if (raDeg === null || decDeg === null) continue;

        if (!this.isObjectVisible(dso, 'dso')) continue;

        this._tempLocalPosVector.copy(sr.celestialToCartesian(raDeg, decDeg, sphereRadius));
        if (sr.starSphereGroup) this._tempLocalPosVector.applyMatrix4(sr.starSphereGroup.matrixWorld);

        this._tempProjVector.copy(this._tempLocalPosVector).project(sr.camera);
        if (this._tempProjVector.z > 1.0) continue;

        const screenX = (this._tempProjVector.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-this._tempProjVector.y * 0.5 + 0.5) * rect.height + rect.top;

        const dx = clientX - screenX;
        const dy = clientY - screenY;
        const distSq = dx * dx + dy * dy;
        const radius = isZoomedOut ? 36 : (isMediumZoom ? 44 : 52);
        const radiusSq = radius * radius;

        if (distSq <= radiusSq) {
          const dsoKey = String(dso.id || dso.name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
          const dsoSubtypes = ['dso', 'oc', 'gc', 'g', 'pn', 'sfr', 'rn', 'e', 's', 'snr', 'pos', 'i', 'ngc', 'ic', 'messier', 'open cluster', 'globular cluster', 'planetary nebula', 'galaxy', 'nebula'];
          const foundInSearch = searchObjects.find(s => s && dsoSubtypes.includes(String(s.type || '').toLowerCase()) && (
            String(s.id || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === dsoKey ||
            String(s.name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === dsoKey ||
            String(s.displayName || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') === dsoKey
          ));
          const baseDSO = foundInSearch || {
            type: 'dso',
            id: dso.id || dso.name,
            name: dso.name || dso.id,
            displayName: dso.name || dso.id,
            ra: dso.ra,
            dec: dso.dec,
            mag: dso.mag || "N/A",
            position: dso.position,
            rawObj: dso
          };
          const candObj = {
            ...baseDSO,
            position: this._tempLocalPosVector.clone()
          };

          const dist = Math.sqrt(distSq);
          let score = dist / radius;
          if (dist <= 6.0) score -= 0.4;

          this._pickingCandidates.push({
            obj: candObj,
            dist,
            radius,
            score,
            tier: 2,
            isLabelHit: false
          });
        }
      }
    }

    // 3. Evaluate Satellites & Spacecraft catalog fallback
    if (sr.showSatellites !== false && sr.minorBodiesSystem && Array.isArray(sr.minorBodiesSystem.satellitesList)) {
      const satList = sr.minorBodiesSystem.satellitesList;
      for (let i = 0; i < satList.length; i++) {
        const sat = satList[i];
        if (!sat || !sat.position) continue;
        if (!this.isObjectVisible(sat, 'satellite')) continue;

        this._tempLocalPosVector.copy(sat.position);
        if (sr.starSphereGroup) this._tempLocalPosVector.applyMatrix4(sr.starSphereGroup.matrixWorld);

        this._tempProjVector.copy(this._tempLocalPosVector).project(sr.camera);
        if (this._tempProjVector.z > 1.0) continue;

        const screenX = (this._tempProjVector.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-this._tempProjVector.y * 0.5 + 0.5) * rect.height + rect.top;

        const dx = clientX - screenX;
        const dy = clientY - screenY;
        const distSq = dx * dx + dy * dy;
        const radius = isZoomedOut ? 22 : (isMediumZoom ? 26 : 30);
        const radiusSq = radius * radius;

        if (distSq <= radiusSq) {
          const satName = String(sat.name || sat.OBJECT_NAME || '').toLowerCase();
          const foundInSearch = searchObjects.find(s => s && s.type === 'satellite' && (String(s.name || '').toLowerCase().includes(satName) || String(s.id || '').toLowerCase() === String(sat.NORAD_CAT_ID).toLowerCase()));
          const candObj = foundInSearch || {
            type: 'satellite',
            id: String(sat.NORAD_CAT_ID || sat.id || sat.name || sat.OBJECT_NAME),
            name: sat.name || sat.OBJECT_NAME,
            displayName: sat.name || sat.OBJECT_NAME,
            ra: 0,
            dec: 0,
            position: sat.position,
            satData: sat,
            rawObj: sat
          };

          const dist = Math.sqrt(distSq);
          let score = dist / radius;
          if (dist <= 6.0) score -= 0.4;

          this._pickingCandidates.push({
            obj: candObj,
            dist,
            radius,
            score,
            tier: 3,
            isLabelHit: false
          });
        }
      }
    }
    // 4B. Asteroids & Comets catalog fallback
if (
    sr.minorBodiesSystem
) {

    const addMinorBodyCandidates = (
        list,
        type,
        enabled,
        radius
    ) => {

        if (
            !enabled ||
            !Array.isArray(list)
        ) {
            return;
        }

        for (
            let i = 0;
            i < list.length;
            i++
        ) {
            const body = list[i];

            if (
                !body ||
                !body.position
            ) {
                continue;
            }

            if (
                body.isVisible === false &&
                Number(body.currentOpacity || 0) <= 0.01
            ) {
                continue;
            }

            const obj = {
                type,
                id:
                    body.id ||
                    body.name,
                name:
                    body.name ||
                    body.displayName ||
                    body.id,
                displayName:
                    body.displayName ||
                    body.name ||
                    body.id,
                ra: body.ra,
                dec: body.dec,
                position: body.position,
                rawObj: body
            };

            this._tempLocalPosVector.copy(
                body.position
            );

            if (sr.starSphereGroup) {
                this._tempLocalPosVector.applyMatrix4(
                    sr.starSphereGroup.matrixWorld
                );
            }

            this._tempProjVector
                .copy(this._tempLocalPosVector)
                .project(sr.camera);

            if (
                this._tempProjVector.z < -1 ||
                this._tempProjVector.z > 1
            ) {
                continue;
            }

            const screenX =
                (
                    this._tempProjVector.x *
                    0.5 + 0.5
                ) * rect.width + rect.left;

            const screenY =
                (
                    -this._tempProjVector.y *
                    0.5 + 0.5
                ) * rect.height + rect.top;

            const dx =
                clientX - screenX;

            const dy =
                clientY - screenY;

            const distSq =
                dx * dx + dy * dy;

            if (
                distSq <= radius * radius
            ) {

                const dist =
                    Math.sqrt(distSq);

                this._pickingCandidates.push({
                    obj,
                    dist,
                    radius,
                    score: dist / radius,
                    tier: 4,
                    isLabelHit: false
                });
            }
        }
    };

    addMinorBodyCandidates(
        sr.minorBodiesSystem.asteroidsList,
        "asteroid",
        sr.showAsteroids !== false,
        isZoomedOut ? 24 : 34
    );

    addMinorBodyCandidates(
        sr.minorBodiesSystem.cometsList,
        "comet",
        sr.showComets !== false,
        isZoomedOut ? 28 : 38
    );
}

    // 4. Evaluate Stars catalog fallback
    if (sr.showStars !== false && sr.starRenderingSystem && Array.isArray(sr.starRenderingSystem.starsList)) {
      const sphereRadius = sr.options.sphereRadius * 0.995;
      const starList = sr.starRenderingSystem.starsList;

      for (let i = 0; i < starList.length; i++) {
        const star = starList[i];
        if (!star || typeof star.ra !== 'number' || typeof star.dec !== 'number') continue;

        if (!this.isObjectVisible(star, 'star')) continue;
        const mag = parseFloat(star.mag);

        this._tempLocalPosVector.copy(sr.celestialToCartesian(star.ra, star.dec, sphereRadius));
        if (sr.starSphereGroup) this._tempLocalPosVector.applyMatrix4(sr.starSphereGroup.matrixWorld);

        this._tempProjVector.copy(this._tempLocalPosVector).project(sr.camera);
        if (this._tempProjVector.z > 1.0) continue;

        const screenX = (this._tempProjVector.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-this._tempProjVector.y * 0.5 + 0.5) * rect.height + rect.top;

        const dx = clientX - screenX;
        const dy = clientY - screenY;
        const distSq = dx * dx + dy * dy;

        const isBrightStar = !isNaN(mag) && mag <= 2.0;
        const radius = isBrightStar ? (isZoomedOut ? 28 : (isMediumZoom ? 34 : 40)) : (isZoomedOut ? 22 : (isMediumZoom ? 26 : 32));
        const radiusSq = radius * radius;

        if (distSq <= radiusSq) {
          const starName = String(star.name || star.properName || star.bayerName || star.id || '').toLowerCase().replace(/\s+/g, '');
          const foundInSearch = searchObjects.find(s => s && s.type === 'star' && (
            String(s.id || '').toLowerCase().replace(/\s+/g, '') === starName ||
            String(s.name || '').toLowerCase().replace(/\s+/g, '') === starName ||
            String(s.displayName || '').toLowerCase().replace(/\s+/g, '') === starName
          ));
          const cleanTitle = star.displayName || star.name || star.properName || star.bayerName || (star.hip ? `HIP ${star.hip}` : `Uncatalogued Star`);
          const baseObj = foundInSearch || {
            type: 'star',
            id: String(star.id || star.name),
            name: cleanTitle,
            displayName: cleanTitle,
            ra: star.ra,
            dec: star.dec,
            mag: star.mag !== undefined ? star.mag : "N/A",
            rawObj: star
          };
          const candObj = {
            ...baseObj,
            position: this._tempLocalPosVector.clone()
          };

          const dist = Math.sqrt(distSq);
          let score = dist / radius;
          if (dist <= 6.0) score -= 0.4;

          this._pickingCandidates.push({
            obj: candObj,
            dist,
            radius,
            score,
            tier: 5,
            isLabelHit: false
          });
        }
      }
    }

    if (this._pickingCandidates.length === 0) {
      return null;
    }

    // Sort Candidates by Tier and Proximity
    this._pickingCandidates.sort((a, b) => {
      const aCenter = !a.isLabelHit && a.dist <= 6.0;
      const bCenter = !b.isLabelHit && b.dist <= 6.0;
      if (aCenter !== bCenter) return aCenter ? -1 : 1;

      if (a.isLabelHit !== b.isLabelHit) {
        return a.isLabelHit ? -1 : 1;
      }

      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      return a.score - b.score;
    });

    return this._pickingCandidates[0].obj;
  }
}
