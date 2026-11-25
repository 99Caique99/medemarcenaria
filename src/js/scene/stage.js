// Cena 3D: armário planejado de 3 módulos montado em função do progresso p (0 → 1),
// que vai do início do "Sobre" até o rodapé. Tudo é função pura de p: o scrub
// funciona igual para frente, para trás e com rolagem rápida.
// O canvas é transparente: o móvel aparece sobre o fundo de cada seção.
// As etapas se sobrepõem de propósito: sempre há uma peça em movimento.
//
//   0.00–0.33  Estrutura   rodapé, base, laterais, fundo e tampo chegam e assentam
//   0.30–0.62  Interior    divisórias e prateleiras são empurradas para dentro
//   0.58–0.76  Portas      dobradiças, portas penduradas abertas, fecham com amortecimento
//   0.66–0.86  Detalhes    parafusos (giram), puxadores e fita de LED
//   0.84–1.00  Entrega     brilho passa pelo verniz, luz quente de contorno
import {
  ACESFilmicToneMapping, BoxGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PMREMGenerator, PerspectiveCamera,
  PlaneGeometry, PointLight, Scene, ShadowMaterial, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { contactShadowTexture, pause, woodTexture } from './wood.js';

const C = { gold: '#f9e4b7', goldDeep: '#cba26b', brown: '#5f5549', highlight: '#85603f' };

// Dimensões (metros) — armário 1,80 × 2,40
const W = 1.8, H = 2.2, D = 0.6, T = 0.036, PL = 0.1;
const INNER_Y = PL + T, INNER_H = H - T;
const DIV_X = 0.294, MOD_W = 0.552, SIDE_X = 0.588;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const win = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const E = {
  travel: gsap.parseEase('power3.out'),
  settle: gsap.parseEase('back.out(1.1)'),
  push: gsap.parseEase('power3.out'),
  swing: gsap.parseEase('power2.inOut'),
};

export async function createStage(container, { mobile }) {
  // ---------- Renderer (fundo transparente) ----------
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  await pause();

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const target = new Vector3(0, 1.2, 0);

  // ---------- Luz de estúdio ----------
  scene.add(new HemisphereLight('#fffaf2', '#8a7560', 0.35));
  const key = new DirectionalLight('#fff1dc', 1.6);
  key.position.set(1.6, 7.5, 5.5); // de cima e à frente: a sombra cai atrás do móvel
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.4, bottom: -2.4, near: 1, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new DirectionalLight('#f1e3d3', 0.4);
  fill.position.set(-4, 2.5, 3);
  scene.add(fill);
  const rim = new DirectionalLight(C.goldDeep, 0);
  rim.position.set(-3, 3.5, -4);
  scene.add(rim);
  const sheen = new SpotLight('#ffffff', 0, 14, 0.6, 1, 1.4);
  sheen.position.set(-4, 2.4, 4);
  sheen.target.position.set(0, 1.2, 0);
  scene.add(sheen, sheen.target);
  const ledLight = new PointLight(C.gold, 0, 1.2, 2);
  ledLight.position.set(0, PL + H - 0.16, 0.14);
  scene.add(ledLight);

  // ---------- Chão: só a sombra (o fundo é a própria seção) ----------
  const shadowCatcher = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.2 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);
  const contact = new Mesh(
    new PlaneGeometry(W * 1.7, D * 2.6),
    new MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.002;
  scene.add(contact);

  // ---------- Materiais: madeira ----------
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const size = mobile ? 512 : 1024;
  const tex = {};
  tex.carcass = await woodTexture({ base: '#74543a', dark: '#3a2a1f', light: '#a27a50', seed: 3, size, rings: 46, maxAnisotropy: aniso });
  // Mesma imagem girada 90° (veio vertical nas peças em pé), sem custo extra de memória
  tex.carcassV = tex.carcass.clone();
  tex.carcassV.center.set(0.5, 0.5);
  tex.carcassV.rotation = Math.PI / 2;
  tex.door = await woodTexture({ base: '#6e4c31', dark: '#2f2118', light: '#9c7247', seed: 11, size, rings: 34, vertical: true, maxAnisotropy: aniso });
  tex.back = await woodTexture({ base: '#5a4636', dark: '#33281f', light: '#7c5e44', seed: 9, size: 512, rings: 50, vertical: true, shade: 0.45, maxAnisotropy: aniso });
  const base = {
    carcass: () => new MeshStandardMaterial({ map: tex.carcass, bumpMap: tex.carcass, bumpScale: 0.12, roughness: 0.55 }),
    carcassV: () => new MeshStandardMaterial({ map: tex.carcassV, bumpMap: tex.carcassV, bumpScale: 0.12, roughness: 0.55 }),
    back: () => new MeshStandardMaterial({ map: tex.back, bumpMap: tex.back, bumpScale: 0.1, roughness: 0.72 }),
    door: () => new MeshPhysicalMaterial({
      map: tex.door, bumpMap: tex.door, bumpScale: 0.15, roughness: 0.46, clearcoat: 0.4, clearcoatRoughness: 0.28,
    }),
  };
  // Cada peça tem o próprio material (opacidade independente). Transparência só
  // durante a chegada da peça; depois volta ao pipeline opaco.
  const fade = (m, o) => {
    m.opacity = o;
    m.transparent = o < 0.999;
  };
  const own = (kind) => {
    const m = base[kind]();
    fade(m, 0);
    return m;
  };
  const gold = new MeshStandardMaterial({ color: C.goldDeep, metalness: 1, roughness: 0.22, envMapIntensity: 1.4 });
  const ledMat = new MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0 });

  // ---------- Peças ----------
  const pieces = [];

  // from: deslocamento inicial (curto, como na bancada); lift: arco para cima no trajeto
  function piece(name, dims, pos, kind, { from, rot = [0, 0, 0], lift = 0, a, b, ease = E.settle }) {
    const mesh = new Mesh(new RoundedBoxGeometry(dims[0], dims[1], dims[2], 3, Math.min(0.003, Math.min(...dims) / 3)), own(kind));
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
    pieces.push({ mesh, final: new Vector3(...pos), from: new Vector3(...from), rot, lift, a, b, ease });
    return mesh;
  }

  // Estrutura
  piece('rodape', [W - 0.08, PL, D - 0.08], [0, PL / 2, -0.02], 'carcass', { from: [0, 0, 0.5], a: 0, b: 0.07, ease: E.push });
  piece('base', [W, T, D], [0, PL + T / 2, 0], 'carcass', { from: [0, 0.45, 0.3], lift: 0.1, a: 0.03, b: 0.11 });
  piece('lateral-esq', [T, H, D], [-(W / 2 - T / 2), PL + H / 2, 0], 'carcassV', { from: [-0.6, 0.2, 0.3], rot: [0, 0, 0.1], lift: 0.08, a: 0.08, b: 0.18 });
  piece('lateral-dir', [T, H, D], [W / 2 - T / 2, PL + H / 2, 0], 'carcassV', { from: [0.6, 0.2, 0.3], rot: [0, 0, -0.1], lift: 0.08, a: 0.12, b: 0.22 });
  piece('fundo', [W - 2 * T, INNER_H, 0.012], [0, INNER_Y + INNER_H / 2, -D / 2 + 0.006], 'back', { from: [0, 0.3, -0.6], a: 0.17, b: 0.27, ease: E.push });
  piece('tampo', [W + 0.03, T, D + 0.03], [0, PL + H + T / 2, 0], 'carcass', { from: [0, 0.6, 0.15], rot: [0.05, 0, 0], a: 0.23, b: 0.33 });

  // Interior: tudo empurrado de frente para dentro
  piece('divisoria-1', [T, INNER_H, D - 0.03], [-DIV_X, INNER_Y + INNER_H / 2, -0.015], 'carcassV', { from: [0, 0, 0.8], a: 0.3, b: 0.39, ease: E.push });
  piece('divisoria-2', [T, INNER_H, D - 0.03], [DIV_X, INNER_Y + INNER_H / 2, -0.015], 'carcassV', { from: [0, 0, 0.8], a: 0.34, b: 0.43, ease: E.push });
  [[0, 0.25], [0, 0.5], [0, 0.75], [-SIDE_X, 0.36], [SIDE_X, 0.36], [-SIDE_X, 0.68], [SIDE_X, 0.68]].forEach(([x, k], i) => {
    const a = 0.4 + i * 0.025;
    piece(`prateleira-${i + 1}`, [MOD_W, 0.025, D - 0.05], [x, INNER_Y + INNER_H * k, -0.01], 'carcass', { from: [0, 0, 0.7], a, b: a + 0.07, ease: E.push });
  });

  // LED do nicho central
  const led = new Mesh(new BoxGeometry(MOD_W - 0.05, 0.008, 0.016), ledMat);
  led.position.set(0, PL + H - 0.01, D / 2 - 0.07);
  led.visible = false;
  scene.add(led);

  // Parafusos (cam-lock) nas faces das divisórias voltadas para o nicho
  const screws = [];
  for (const sx of [-1, 1]) {
    for (const y of [INNER_Y + 0.08, PL + H - 0.08]) {
      const s = new Mesh(new CylinderGeometry(0.014, 0.014, 0.006, 20), gold);
      s.rotation.z = Math.PI / 2;
      s.position.set(sx * (DIV_X - T / 2 - 0.003), y, D / 2 - 0.08);
      scene.add(s);
      screws.push(s);
    }
  }

  // Portas: dobradiça na lateral externa; penduradas abertas (90°) e fecham
  const DOOR_W = 0.576, DOOR_H = H - 0.012, DOOR_T = 0.019;
  const doors = [-1, 1].map((side, i) => {
    const pivot = new Group();
    const hingeX = side * (W / 2 - T / 2);
    pivot.position.set(hingeX, PL + T / 2 + DOOR_H / 2 + 0.004, D / 2 + DOOR_T / 2 + 0.002);
    const mat = own('door');
    const door = new Mesh(new RoundedBoxGeometry(DOOR_W, DOOR_H, DOOR_T, 3, 0.003), mat);
    door.receiveShadow = true;
    door.position.x = -side * DOOR_W / 2;
    pivot.add(door);
    const handle = new Mesh(new RoundedBoxGeometry(0.014, 0.42, 0.024, 3, 0.006), gold);
    handle.castShadow = true;
    handle.position.set(-side * (DOOR_W / 2 - 0.045), 0.05, DOOR_T / 2 + 0.014);
    door.add(handle);
    [0.35, -0.35].forEach((f) => {
      const hg = new Mesh(new CylinderGeometry(0.018, 0.018, 0.012, 20), gold);
      hg.rotation.x = Math.PI / 2;
      hg.position.set(-side * 0.035, DOOR_H * f, -DOOR_T / 2 - 0.004);
      door.add(hg);
    });
    scene.add(pivot);
    return { pivot, door, mat, handle, side, final: pivot.position.clone(), a: 0.58 + i * 0.04 };
  });

  // ---------- Câmera ----------
  let fitDist = 6;
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 40 : 30;
    camera.updateProjectionMatrix();
    // Distância para o móvel (≈2,4 m de altura + folga de órbita) caber com respiro.
    const vt = Math.tan((camera.fov * Math.PI) / 360);
    fitDist = Math.max(1.42 / (vt * 0.86), 1.12 / (vt * aspect * 0.86));
  }

  // Órbita numa curva só (sem paradas entre trechos): gira de um lado ao outro,
  // abre menos a cada volta e termina quase de frente.
  function placeCamera(p) {
    const yaw = 0.08 + 0.5 * Math.pow(1 - p, 1.2) * Math.cos(p * Math.PI * 2.2);
    const pitch = 0.1 + 0.24 * Math.pow(1 - p, 1.5);
    const dist = fitDist * (1.04 - 0.09 * smooth(p));
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  // ---------- Progresso ----------
  function setProgress(p) {
    for (const pc of pieces) {
      const t = win(p, pc.a, pc.b);
      const o = smooth(clamp01(t * 2.2));
      pc.mesh.visible = t > 0;
      pc.mesh.castShadow = o > 0.5;
      fade(pc.mesh.material, o);
      const e = pc.ease(t);
      pc.mesh.position.copy(pc.final).addScaledVector(pc.from, 1 - e);
      pc.mesh.position.y += Math.sin(Math.PI * t) * pc.lift;
      pc.mesh.rotation.set(pc.rot[0] * (1 - e), pc.rot[1] * (1 - e), pc.rot[2] * (1 - e));
    }
    contact.material.opacity = smooth(win(p, 0, 0.14));

    for (const d of doors) {
      const tin = win(p, d.a, d.a + 0.06);
      const tclose = E.swing(win(p, d.a + 0.05, d.a + 0.14));
      const o = smooth(clamp01(tin * 2.2));
      d.pivot.visible = tin > 0;
      d.door.castShadow = o > 0.5;
      fade(d.mat, o);
      const e = E.travel(tin);
      d.pivot.position.set(d.final.x + d.side * 0.25 * (1 - e), d.final.y + 0.06 * (1 - e), d.final.z + 0.45 * (1 - e));
      d.pivot.rotation.y = d.side * (Math.PI / 2) * (1 - tclose);
      const th = win(p, 0.74, 0.8);
      d.handle.visible = th > 0;
      d.handle.position.z = DOOR_T / 2 + 0.014 + 0.08 * (1 - E.push(th));
    }

    const ts = win(p, 0.66, 0.72);
    screws.forEach((s, i) => {
      s.visible = ts > 0;
      s.position.z = D / 2 - 0.08 + 0.12 * (1 - E.push(ts));
      s.rotation.x = -(1 - E.push(ts)) * Math.PI * 4 + i;
    });

    const ledOn = smooth(win(p, 0.8, 0.86));
    led.visible = ledOn > 0;
    ledMat.emissiveIntensity = 3.2 * ledOn;
    ledLight.intensity = 1.1 * ledOn;

    const s = win(p, 0.84, 0.95);
    sheen.position.x = -4 + 8 * s;
    sheen.intensity = Math.sin(Math.PI * s) * 10;

    rim.intensity = 1.4 * smooth(win(p, 0.9, 1));
    key.intensity = 1.6 + 0.2 * smooth(win(p, 0.9, 1));

    placeCamera(p);
    renderer.render(scene, camera);
  }

  resize();
  // Compila os shaders em paralelo (KHR_parallel_shader_compile) antes do 1º quadro.
  // Os materiais nascem transparentes: o programa compilado serve para o fade e
  // para a peça já assentada, sem recompilar no meio da rolagem.
  for (const t of Object.values(tex)) {
    renderer.initTexture(t); // envia as texturas à GPU agora, não no meio da rolagem
    await pause();
  }
  await renderer.compileAsync(scene, camera);
  // Quadro de aquecimento com tudo em cena (ainda invisível para o visitante):
  // sombras e estados de GPU ficam prontos antes da primeira rolagem.
  setProgress(1);
  await pause();

  function dispose() {
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    Object.values(tex).forEach((t) => t.dispose());
    envRT.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { setProgress, resize, dispose };
}
