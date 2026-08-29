import * as THREE from 'three';

/**
 * BrightStarGlowSystem - Subtle Luminous Halo for Top ~25 Brightest Stars
 * 
 * Independent visual layer; DOES NOT alter core StarRenderingSystem.
 */
export class BrightStarGlowSystem {
  constructor(options = {}) {
    this.options = {
      radius: options.radius || 796,
      ...options
    };

    this.group = null;
    this.pointsMesh = null;
    this.texture = null;
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.2, 'rgba(235, 242, 255, 0.25)');
    grad.addColorStop(0.5, 'rgba(200, 220, 255, 0.08)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  celestialToCartesian(raDeg, decDeg, r = this.options.radius) {
    const raRad = (raDeg * Math.PI) / 180.0;
    const decRad = (decDeg * Math.PI) / 180.0;

    const x = r * Math.cos(decRad) * Math.cos(raRad);
    const y = r * Math.sin(decRad);
    const z = r * Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z);
  }

  init(starList = []) {
    this.group = new THREE.Group();
    this.group.name = 'brightStarGlowGroup';
    this.group.renderOrder = 1; // Rendered right behind main star points

    // Filter top ~25 brightest stars (mag <= 1.5)
    const brightStars = starList.filter(s => s && s.mag !== undefined && s.mag <= 1.5);
    if (brightStars.length === 0) return this.group;

    const positions = new Float32Array(brightStars.length * 3);
    const sizes = new Float32Array(brightStars.length);
    const opacities = new Float32Array(brightStars.length);

    brightStars.forEach((star, i) => {
      const pos = this.celestialToCartesian(star.ra, star.dec);
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      // Scale glow size and intensity smoothly with magnitude (Sirius gets slightly stronger halo than Deneb)
      const magNorm = Math.max(0.0, 1.5 - star.mag); // Sirius (-1.44) -> 2.94, Betelgeuse (0.45) -> 1.05
      sizes[i] = 16.0 + magNorm * 8.0; // 16px to 38px soft halo
      opacities[i] = Math.min(0.28, 0.12 + magNorm * 0.05); // Subtle, non-glaring opacity
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.texture = this.createGlowTexture();

    const material = new THREE.PointsMaterial({
      size: 24,
      sizeAttenuation: false,
      map: this.texture,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.pointsMesh = new THREE.Points(geometry, material);
    this.group.add(this.pointsMesh);

    return this.group;
  }
}
