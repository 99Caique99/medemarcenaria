// Cena 3D: armário planejado de 3 módulos montado em função do progresso p (0 → 1),
// que vai do início do "Sobre" até o rodapé. Tudo é função pura de p: o scrub
// funciona igual para frente, para trás e com rolagem rápida.
// O canvas é transparente: o móvel aparece sobre o fundo de cada seção.
//
//   0.00–0.12  Projeto     linhas finas desenham o contorno
//   0.08–0.30  Estrutura   rodapé, base, laterais, fundo e tampo chegam e assentam (MDF cru)
//   0.30–0.48  Interior    divisórias e prateleiras são empurradas para dentro
//   0.48–0.66  Portas      dobradiças, portas penduradas abertas, fecham com amortecimento
//   0.66–0.78  Detalhes    puxadores, parafusos (giram) e fita de LED
//   0.78–0.90  Acabamento  MDF cru recebe a madeira; brilho passa pelo verniz
//   0.90–1.00  Entrega     luz quente de contorno, móvel pronto
import {
  ACESFilmicToneMapping, BoxGeometry, CylinderGeometry, DirectionalLight, EdgesGeometry, Group, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial,
  PCFSoftShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry, PointLight, Scene, ShadowMaterial, SpotLight,
  SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { contactShadowTexture, woodTexture } from './wood.js';

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
  settle: gsap.parseEase('back.out(1.15)'),
  push: gsap.parseEase('power4.out'),
  swing: gsap.parseEase('power2.inOut'),
};

function keyed(frames, p) {
  if (p <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [p1, v1] = frames[i];
    const [p0, v0] = frames[i - 1];
    if (p <= p1) return v0 + (v1 - v0) * smooth((p - p0) / (p1 - p0));
  }
  return frames.at(-1)[1];
}

// Montagem fatiada em etapas com pausas (texturas, materiais, shaders) para não
// gerar tarefas longas no main thread.
const pause = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)));

export async function createStage(container, { mobile }) {
  // ---------- Renderer (fundo transparente) ----------
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();
  await pause();

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const target = new Vector3(0, 1.2, 0);

  // ---------- Luz de estúdio ----------
  scene.add(new HemisphereLight('#fffaf2', '#8a7560', 0.38));
  const key = new DirectionalLight('#fff3e2', 1.45);
  key.position.set(1.6, 7.5, 5.5); // de cima e à frente: a sombra cai atrás do móvel
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -3, near: 1, far: 20 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 7;
  scene.add(key);
  const fill = new DirectionalLight('#f1e3d3', 0.45);
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

  // ---------- Materiais ----------
  // Mistura compartilhada "MDF cru" → madeira (etapa de acabamento).
  const uWood = { value: 0 };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const size = mobile ? 512 : 1024;
  const withWoodMix = (m) => {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWood = uWood;
      shader.fragmentShader = 'uniform float uWood;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(0.62, 0.5, 0.36), diffuseColor.rgb, uWood);',
      );
    };
    return m;
  };
  const tex = {};
  tex.carcass = woodTexture({ base: '#6a5340', dark: '#43382e', light: C.highlight, seed: 3, size, maxAnisotropy: aniso });
  await pause();
  tex.door = woodTexture({ base: '#7a5c42', dark: '#4a3c30', light: '#a07a52', seed: 11, size, vertical: true, maxAnisotropy: aniso });
  await pause();
  tex.back = woodTexture({ base: '#4d4137', dark: '#382f27', light: C.brown, seed: 9, size, maxAnisotropy: aniso });
  await pause();
  const base = {
    carcass: () => withWoodMix(new MeshStandardMaterial({ map: tex.carcass, bumpMap: tex.carcass, bumpScale: 0.6, roughness: 0.58 })),
    back: () => withWoodMix(new MeshStandardMaterial({ map: tex.back, bumpMap: tex.back, bumpScale: 0.4, roughness: 0.75 })),
    door: () => withWoodMix(new MeshPhysicalMaterial({
      map: tex.door, bumpMap: tex.door, bumpScale: 0.8, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.32,
    })),
  };
  // Cada peça tem o próprio material (opacidade independente). alphaHash = fade sem
  // ordenação de transparência (a peça continua no pipeline opaco).
  const own = (kind) => {
    const m = base[kind]();
    m.alphaHash = true;
    m.opacity = 0;
    return m;
  };
  const gold = new MeshStandardMaterial({ color: C.goldDeep, metalness: 1, roughness: 0.22, envMapIntensity: 1.4, alphaHash: true, opacity: 0 });
  const ledMat = new MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0 });
  const lineMat = new LineBasicMaterial({ color: C.goldDeep, transparent: true, opacity: 0, depthWrite: false });

  // ---------- Peças ----------
  const pieces = [];
  const ghosts = [];
  const ghostGroup = new Group();
  scene.add(ghostGroup);
  let gi = 0;

  function addGhost(dims, pos) {
    const line = new LineSegments(new EdgesGeometry(new BoxGeometry(...dims)), lineMat);
    line.position.copy(pos);
    line.geometry.setDrawRange(0, 0);
    ghostGroup.add(line);
    const a = gi++ * 0.0045;
    ghosts.push({ line, a, b: a + 0.045, count: line.geometry.attributes.position.count });
  }

  // from: deslocamento inicial (curto, como na bancada); lift: arco para cima no trajeto
  function piece(name, dims, pos, kind, { from, rot = [0, 0, 0], lift = 0, a, b, ease = E.settle }) {
    const mesh = new Mesh(new RoundedBoxGeometry(dims[0], dims[1], dims[2], 3, Math.min(0.003, Math.min(...dims) / 3)), own(kind));
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const final = new Vector3(...pos);
    pieces.push({ mesh, final, from: new Vector3(...from), rot, lift, a, b, ease });
    addGhost(dims, final);
    return mesh;
  }

  // Estrutura
  piece('rodape', [W - 0.08, PL, D - 0.08], [0, PL / 2, -0.02], 'carcass', { from: [0, 0, 0.45], a: 0.08, b: 0.13, ease: E.push });
  piece('base', [W, T, D], [0, PL + T / 2, 0], 'carcass', { from: [0, 0.35, 0.25], lift: 0.12, a: 0.1, b: 0.16 });
  piece('lateral-esq', [T, H, D], [-(W / 2 - T / 2), PL + H / 2, 0], 'carcass', { from: [-0.55, 0.18, 0.3], rot: [0, 0, 0.1], lift: 0.1, a: 0.13, b: 0.2 });
  piece('lateral-dir', [T, H, D], [W / 2 - T / 2, PL + H / 2, 0], 'carcass', { from: [0.55, 0.18, 0.3], rot: [0, 0, -0.1], lift: 0.1, a: 0.16, b: 0.23 });
  piece('fundo', [W - 2 * T, INNER_H, 0.012], [0, INNER_Y + INNER_H / 2, -D / 2 + 0.006], 'back', { from: [0, 0, -0.5], a: 0.2, b: 0.26, ease: E.push });
  piece('tampo', [W + 0.03, T, D + 0.03], [0, PL + H + T / 2, 0], 'carcass', { from: [0, 0.55, 0.15], rot: [0.05, 0, 0], a: 0.23, b: 0.3 });

  // Interior: tudo empurrado de frente para dentro
  piece('divisoria-1', [T, INNER_H, D - 0.03], [-DIV_X, INNER_Y + INNER_H / 2, -0.015], 'carcass', { from: [0, 0, 0.7], a: 0.3, b: 0.36, ease: E.push });
  piece('divisoria-2', [T, INNER_H, D - 0.03], [DIV_X, INNER_Y + INNER_H / 2, -0.015], 'carcass', { from: [0, 0, 0.7], a: 0.32, b: 0.38, ease: E.push });
  const shelf = (i, x, k, a) => piece(`prateleira-${i}`, [MOD_W, 0.025, D - 0.05], [x, INNER_Y + INNER_H * k, -0.01], 'carcass',
    { from: [0, 0, 0.6], a, b: a + 0.05, ease: E.push });
  shelf(1, 0, 0.25, 0.36);
  shelf(2, 0, 0.5, 0.38);
  shelf(3, 0, 0.75, 0.4);
  shelf(4, -SIDE_X, 0.36, 0.41);
  shelf(5, SIDE_X, 0.36, 0.42);
  shelf(6, -SIDE_X, 0.68, 0.43);
  shelf(7, SIDE_X, 0.68, 0.44);

  // LED do nicho central
  const led = new Mesh(new BoxGeometry(MOD_W - 0.05, 0.008, 0.016), ledMat);
  led.position.set(0, PL + H - 0.01, D / 2 - 0.07);
  led.visible = false;
  scene.add(led);

  // Parafusos (cam-lock) nas faces das divisórias voltadas para o nicho
  const screws = [];
  for (const sx of [-1, 1]) {
    for (const y of [INNER_Y + 0.08, PL + H - 0.08]) {
      const s = new Mesh(new CylinderGeometry(0.014, 0.014, 0.006, 20), gold.clone());
      s.rotation.z = Math.PI / 2;
      s.position.set(sx * (DIV_X - T / 2 - 0.003), y, D / 2 - 0.08);
      s.castShadow = true;
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
    door.castShadow = door.receiveShadow = true;
    door.position.x = -side * DOOR_W / 2;
    pivot.add(door);
    const handleMat = gold.clone();
    const handle = new Mesh(new RoundedBoxGeometry(0.014, 0.42, 0.024, 3, 0.006), handleMat);
    handle.castShadow = true;
    handle.position.set(-side * (DOOR_W / 2 - 0.045), 0.05, DOOR_T / 2 + 0.014);
    door.add(handle);
    const hinges = [0.35, -0.35].map((f) => {
      const hg = new Mesh(new CylinderGeometry(0.018, 0.018, 0.012, 20), gold.clone());
      hg.rotation.x = Math.PI / 2;
      hg.position.set(-side * 0.035, DOOR_H * f, -DOOR_T / 2 - 0.004);
      door.add(hg);
      return hg;
    });
    scene.add(pivot);
    addGhost([DOOR_W, DOOR_H, DOOR_T], new Vector3(hingeX - side * DOOR_W / 2, pivot.position.y, pivot.position.z));
    return { pivot, mat, handle, handleMat, hinges, side, final: pivot.position.clone(), a: 0.5 + i * 0.03 };
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

  function placeCamera(p) {
    const yaw = keyed([[0, 0.55], [0.3, -0.38], [0.6, 0.32], [0.82, 0.14], [1, 0.06]], p);
    const pitch = keyed([[0, 0.34], [0.5, 0.2], [1, 0.1]], p);
    const dist = fitDist * keyed([[0, 1.04], [0.5, 1], [1, 0.95]], p);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  // ---------- Progresso ----------
  function setProgress(p) {
    // Projeto: linhas desenhadas, somem quando as peças chegam
    for (const gh of ghosts) gh.line.geometry.setDrawRange(0, Math.floor((gh.count * win(p, gh.a, gh.b)) / 2) * 2);
    lineMat.opacity = 0.85 * (1 - smooth(win(p, 0.2, 0.42)));
    ghostGroup.visible = lineMat.opacity > 0.01;

    for (const pc of pieces) {
      const t = win(p, pc.a, pc.b);
      pc.mesh.visible = t > 0;
      pc.mesh.material.opacity = smooth(clamp01(t * 3));
      const e = pc.ease(t);
      pc.mesh.position.copy(pc.final).addScaledVector(pc.from, 1 - e);
      pc.mesh.position.y += Math.sin(Math.PI * t) * pc.lift;
      pc.mesh.rotation.set(pc.rot[0] * (1 - e), pc.rot[1] * (1 - e), pc.rot[2] * (1 - e));
    }
    contact.material.opacity = smooth(win(p, 0.08, 0.2));

    for (const d of doors) {
      const tin = win(p, d.a, d.a + 0.05);
      const tclose = E.swing(win(p, d.a + 0.05, d.a + 0.13));
      d.pivot.visible = tin > 0;
      d.mat.opacity = smooth(clamp01(tin * 2.5));
      const e = E.travel(tin);
      d.pivot.position.set(d.final.x + d.side * 0.25 * (1 - e), d.final.y + 0.06 * (1 - e), d.final.z + 0.45 * (1 - e));
      d.pivot.rotation.y = d.side * (Math.PI / 2) * (1 - tclose);
      const hgo = smooth(win(p, d.a - 0.02, d.a + 0.02));
      d.hinges.forEach((hg) => { hg.material.opacity = hgo; });
      const th = win(p, 0.66, 0.7);
      d.handleMat.opacity = smooth(th);
      d.handle.position.z = DOOR_T / 2 + 0.014 + 0.06 * (1 - E.push(th));
    }

    const ts = win(p, 0.69, 0.74);
    screws.forEach((s, i) => {
      s.material.opacity = smooth(clamp01(ts * 3));
      s.rotation.x = -(1 - E.push(ts)) * Math.PI * 4 + i;
    });

    const ledOn = smooth(win(p, 0.73, 0.78));
    led.visible = ledOn > 0;
    ledMat.emissiveIntensity = 3.2 * ledOn;
    ledLight.intensity = 1.1 * ledOn;

    uWood.value = smooth(win(p, 0.78, 0.88));
    const s = win(p, 0.84, 0.93);
    sheen.position.x = -4 + 8 * s;
    sheen.intensity = Math.sin(Math.PI * s) * 10;

    rim.intensity = 1.4 * smooth(win(p, 0.9, 1));
    key.intensity = 1.45 + 0.2 * smooth(win(p, 0.9, 1));

    placeCamera(p);
    renderer.render(scene, camera);
  }

  resize();
  await pause();
  // Compila os shaders em paralelo (KHR_parallel_shader_compile) antes do 1º quadro.
  await renderer.compileAsync(scene, camera);

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
