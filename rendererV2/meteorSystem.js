import * as THREE from 'three';

export const METEOR_SHOWERS = [
  { id: "quadrantids", name: "Quadrantids", type: "meteor_shower", peakMonth: 0, peakDay: 3, ra: 230.1, dec: 48.5, zhr: 120, parent: "Asteroid 2003 EH1" },
  { id: "lyrids", name: "Lyrids", type: "meteor_shower", peakMonth: 3, peakDay: 22, ra: 271.4, dec: 33.3, zhr: 18, parent: "Comet C/1861 G1 (Thatcher)" },
  { id: "eta_aquariids", name: "Eta Aquariids", type: "meteor_shower", peakMonth: 4, peakDay: 5, ra: 338.0, dec: -1.0, zhr: 50, parent: "Comet 1P/Halley" },
  { id: "perseids", name: "Perseids", type: "meteor_shower", peakMonth: 7, peakDay: 12, ra: 46.2, dec: 57.4, zhr: 100, parent: "Comet 109P/Swift-Tuttle" },
  { id: "orionids", name: "Orionids", type: "meteor_shower", peakMonth: 9, peakDay: 21, ra: 95.0, dec: 15.5, zhr: 20, parent: "Comet 1P/Halley" },
  { id: "leonids", name: "Leonids", type: "meteor_shower", peakMonth: 10, peakDay: 17, ra: 153.0, dec: 22.0, zhr: 15, parent: "Comet 55P/Tempel-Tuttle" },
  { id: "geminids", name: "Geminids", type: "meteor_shower", peakMonth: 11, peakDay: 14, ra: 112.5, dec: 33.0, zhr: 150, parent: "Asteroid 3200 Phaethon" }
];

export class MeteorSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "MeteorSystemGroup";
    this.scene.add(this.group);

    this.visible = false;
    this.activeStreaks = [];
    this.maxStreaks = 8;
    this.skyRadius = 490;

    this.initRadiantMarkers();
    this.initStreakPool();
  }

  raDecToVector3(raDeg, decDeg, radius = 490) {
    const raRad = (raDeg * Math.PI) / 180;
    const decRad = (decDeg * Math.PI) / 180;
    const x = radius * Math.cos(decRad) * Math.cos(raRad);
    const y = radius * Math.sin(decRad);
    const z = radius * Math.cos(decRad) * Math.sin(raRad);
    return new THREE.Vector3(x, y, z);
  }

  initRadiantMarkers() {
    this.radiantGroup = new THREE.Group();
    this.group.add(this.radiantGroup);

    const circleGeo = new THREE.RingGeometry(3.5, 4.5, 32);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0xff3b6f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });

    METEOR_SHOWERS.forEach(shower => {
      const pos = this.raDecToVector3(shower.ra, shower.dec, this.skyRadius);
      const ringMesh = new THREE.Mesh(circleGeo, circleMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(0, 0, 0);
      ringMesh.userData = shower;
      this.radiantGroup.add(ringMesh);
    });
  }

  initStreakPool() {
    this.streakGroup = new THREE.Group();
    this.group.add(this.streakGroup);
  }

  spawnStreak() {
    if (!this.visible || this.activeStreaks.length >= this.maxStreaks) return;

    const shower = METEOR_SHOWERS[Math.floor(Math.random() * METEOR_SHOWERS.length)];
    const startPos = this.raDecToVector3(
      shower.ra + (Math.random() - 0.5) * 20,
      shower.dec + (Math.random() - 0.5) * 20,
      this.skyRadius
    );

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40
    ).normalize();

    const speed = 12 + Math.random() * 18;
    const maxLife = 30 + Math.random() * 25;

    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      startPos.x, startPos.y, startPos.z,
      startPos.x - dir.x * 15, startPos.y - dir.y * 15, startPos.z - dir.z * 15
    ]);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });

    const streakLine = new THREE.Line(lineGeo, lineMat);
    this.streakGroup.add(streakLine);

    this.activeStreaks.push({
      line: streakLine,
      startPos: startPos,
      dir: dir,
      speed: speed,
      life: 0,
      maxLife: maxLife,
      length: 15 + Math.random() * 25
    });
  }

  update(delta = 0.016) {
    if (!this.visible) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    if (Math.random() < 0.15) {
      this.spawnStreak();
    }

    for (let i = this.activeStreaks.length - 1; i >= 0; i--) {
      const s = this.activeStreaks[i];
      s.life += 1;

      s.startPos.addScaledVector(s.dir, s.speed * delta);
      const head = s.startPos;
      const tail = head.clone().sub(s.dir.clone().multiplyScalar(s.length));

      const posAttr = s.line.geometry.attributes.position;
      posAttr.setXYZ(0, head.x, head.y, head.z);
      posAttr.setXYZ(1, tail.x, tail.y, tail.z);
      posAttr.needsUpdate = true;

      const progress = s.life / s.maxLife;
      s.line.material.opacity = Math.max(0, 1.0 - progress);

      if (s.life >= s.maxLife || s.line.material.opacity <= 0) {
        this.streakGroup.remove(s.line);
        s.line.geometry.dispose();
        s.line.material.dispose();
        this.activeStreaks.splice(i, 1);
      }
    }
  }

  setVisible(visible) {
    this.visible = !!visible;
    this.group.visible = this.visible;
    if (!this.visible) {
      for (let i = this.activeStreaks.length - 1; i >= 0; i--) {
        const s = this.activeStreaks[i];
        this.streakGroup.remove(s.line);
        s.line.geometry.dispose();
        s.line.material.dispose();
      }
      this.activeStreaks = [];
    }
  }
}
