// Cena 3D: armário planejado de 3 módulos sendo construído em função do
// progresso p (0 → 1) do scroll. Tudo é função pura de p: o scrub funciona
// igual para frente, para trás e com rolagem rápida.
//
//   0.00–0.20  Projeto     linhas de luz desenham o contorno
//   0.16–0.42  Estrutura   rodapé, base, laterais, tampo e fundo voam e encaixam
//   0.40–0.58  Interior    divisórias descem, prateleiras deslizam
//   0.56–0.75  Portas      entram abertas, giram na dobradiça e fecham; puxadores
//   0.70–0.92  Acabamento  MDF cru vira madeira, LED acende, feixe de luz passa
//   0.86–1.00  Entrega     câmera se aproxima (a cena se dissolve na foto real)
import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, Color, DirectionalLight, EdgesGeometry, Fog, Group,
  HemisphereLight, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PCFSoftShadowMap,
  PMREMGenerator, PerspectiveCamera, PlaneGeometry, PointLight, Scene, SpotLight, SRGBColorSpace, Vector3,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { woodTexture } from './wood.js';

// Paleta (e derivados escuros por mistura com preto)
const C = {
  cream: '#f1e3d3', gold: '#f9e4b7', goldDeep: '#cba26b', brown: '#5f5549', highlight: '#85603f',
  stage: '#342f28', floor: '#2b2621', doorWood: '#9a744c',
};

// Dimensões (metros) — armário 1,80 × 2,40
const W = 1.8, H = 2.2, D = 0.6, T = 0.036, PL = 0.1;
const INNER_Y = PL + T;             // fundo interno
const INNER_H = H - T;
const DIV_X = 0.294;                // eixo das divisórias
const MOD_W = 0.552;                // largura útil de cada módulo
const SIDE_X = 0.588;               // centro dos módulos laterais

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const win = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const E = {
  settle: gsap.parseEase('back.out(1.35)'),
  out: gsap.parseEase('power3.out'),
  inOut: gsap.parseEase('power2.inOut'),
  door: gsap.parseEase('power3.inOut'),
};

// Interpolação suave entre keyframes [p, valor]
function keyed(frames, p) {
  if (p <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [p1, v1] = frames[i];
    const [p0, v0] = frames[i - 1];
    if (p <= p1) return v0 + (v1 - v0) * smooth((p - p0) / (p1 - p0));
  }
  return frames.at(-1)[1];
}

export function createStage(container, { mobile }) {
  // ---------- Renderer ----------
  const renderer = new WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(C.stage);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(C.stage);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.24;
  pmrem.dispose();

  const camera = new PerspectiveCamera(32, 1, 0.1, 60);
  const target = new Vector3(0, 1.18, 0);

  // ---------- Luzes ----------
  scene.add(new HemisphereLight(C.gold, C.floor, 0.32));
  const key = new DirectionalLight('#fff1dc', 1.55);
  key.position.set(3.2, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: 1, far: 15 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new DirectionalLight(C.goldDeep, 1.1);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const sweep = new SpotLight('#fff6e8', 0, 14, 0.55, 1, 1.4);
  sweep.position.set(-4, 2.6, 3.4);
  sweep.target.position.set(0, 1.2, 0);
  scene.add(sweep, sweep.target);
  const ledLight = new PointLight(C.gold, 0, 1.2, 2);
  ledLight.position.set(0, PL + H - 0.18, 0.12);
  scene.add(ledLight);

  // ---------- Chão ----------
  const floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: C.floor, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- Materiais ----------
  // Um uniform compartilhado mistura "MDF cru" (creme) → madeira na etapa de acabamento.
  const uWood = { value: 0 };
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const woodMat = (opts, roughness) => {
    const m = new MeshStandardMaterial({ map: woodTexture({ ...opts, maxAnisotropy: aniso, size: mobile ? 512 : 1024 }), roughness, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWood = uWood;
      shader.fragmentShader = 'uniform float uWood;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(0.86, 0.76, 0.64), diffuseColor.rgb, uWood);',
      );
    };
    return m;
  };
  const M = {
    carcass: woodMat({ base: C.brown, dark: '#3f3830', light: C.highlight, seed: 3 }, 0.55),
    shelf: woodMat({ base: '#6f5641', dark: C.brown, light: C.highlight, seed: 5 }, 0.55),
    back: woodMat({ base: '#4a3f34', dark: '#3a322a', light: C.brown, seed: 9 }, 0.75),
    door: woodMat({ base: '#6f5641', dark: '#4a3f34', light: C.highlight, seed: 11, vertical: true }, 0.45),
    gold: new MeshStandardMaterial({ color: C.goldDeep, metalness: 1, roughness: 0.26, envMapIntensity: 1.6 }),
    led: new MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0 }),
  };
  const lineMat = new LineBasicMaterial({ color: C.gold, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false });

  // ---------- Peças ----------
  const pieces = [];   // { obj, final, from, rot, a, b, ease }
  const ghosts = [];   // linhas de projeto: { line, a, b }
  const ghostGroup = new Group();
  scene.add(ghostGroup);

  function addGhost(size, pos, a) {
    const line = new LineSegments(new EdgesGeometry(new BoxGeometry(...size)), lineMat);
    line.position.set(...pos);
    line.geometry.setDrawRange(0, 0);
    ghostGroup.add(line);
    ghosts.push({ line, a, b: a + 0.07, count: line.geometry.attributes.position.count });
  }

  function piece(name, size, pos, mat, { from = [0, 0, 0], rot = [0, 0, 0], a, b, ease = E.settle, ghostAt }) {
    const mesh = new Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(0.004, Math.min(...size) / 3)), mat);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(...pos);
    scene.add(mesh);
    pieces.push({ obj: mesh, final: new Vector3(...pos), from: new Vector3(...from), rot, a, b, ease });
    addGhost(size, pos, ghostAt);
    return mesh;
  }

  let g = 0;
  const nextGhost = () => (g++ * 0.0085);

  // Estrutura
  piece('rodape', [W - 0.08, PL, D - 0.08], [0, PL / 2, -0.02], M.carcass, { from: [0, -1.4, 0], a: 0.16, b: 0.24, ghostAt: nextGhost() });
  piece('base', [W, T, D], [0, PL + T / 2, 0], M.carcass, { from: [0, -1.6, 0.8], rot: [0.35, 0, 0], a: 0.18, b: 0.27, ghostAt: nextGhost() });
  piece('lateral-esq', [T, H, D], [-(W / 2 - T / 2), PL + H / 2, 0], M.carcass, { from: [-2.6, 0.9, 0.6], rot: [0, 0.4, 0.55], a: 0.22, b: 0.32, ghostAt: nextGhost() });
  piece('lateral-dir', [T, H, D], [W / 2 - T / 2, PL + H / 2, 0], M.carcass, { from: [2.6, 0.9, 0.6], rot: [0, -0.4, -0.55], a: 0.25, b: 0.35, ghostAt: nextGhost() });
  piece('tampo', [W + 0.03, T, D + 0.03], [0, PL + H + T / 2, 0], M.carcass, { from: [0, 2.4, 0.4], rot: [-0.45, 0, 0.1], a: 0.3, b: 0.4, ghostAt: nextGhost() });
  piece('fundo', [W - 2 * T, INNER_H, 0.012], [0, INNER_Y + INNER_H / 2, -D / 2 + 0.006], M.back, { from: [0, 0, -2.2], a: 0.33, b: 0.42, ease: E.out, ghostAt: nextGhost() });

  // Interior
  piece('divisoria-1', [T, INNER_H, D - 0.03], [-DIV_X, INNER_Y + INNER_H / 2, -0.015], M.shelf, { from: [0, 2.2, 0], a: 0.4, b: 0.47, ghostAt: nextGhost() });
  piece('divisoria-2', [T, INNER_H, D - 0.03], [DIV_X, INNER_Y + INNER_H / 2, -0.015], M.shelf, { from: [0, 2.2, 0], a: 0.42, b: 0.49, ghostAt: nextGhost() });
  [0.25, 0.5, 0.75].forEach((k, i) => {
    piece(`prateleira-${i + 1}`, [MOD_W, 0.025, D - 0.05], [0, INNER_Y + INNER_H * k, -0.01], M.shelf,
      { from: [0, 0, 2.2], a: 0.46 + i * 0.025, b: 0.53 + i * 0.025, ease: E.out, ghostAt: nextGhost() });
  });
  [0.36, 0.68].forEach((k, i) => {
    piece(`prateleira-${4 + i}`, [MOD_W, 0.025, D - 0.05], [-SIDE_X, INNER_Y + INNER_H * k, -0.01], M.shelf,
      { from: [-2, 0, 0.4], a: 0.5 + i * 0.02, b: 0.56 + i * 0.02, ease: E.out, ghostAt: nextGhost() });
    piece(`prateleira-${6 + i}`, [MOD_W, 0.025, D - 0.05], [SIDE_X, INNER_Y + INNER_H * k, -0.01], M.shelf,
      { from: [2, 0, 0.4], a: 0.51 + i * 0.02, b: 0.57 + i * 0.02, ease: E.out, ghostAt: nextGhost() });
  });

  // LED do nicho central
  const led = new Mesh(new BoxGeometry(MOD_W - 0.05, 0.01, 0.018), M.led);
  led.position.set(0, PL + H - 0.012, D / 2 - 0.07);
  scene.add(led);

  // Portas: pivô na dobradiça (lateral externa), giram em Y
  const DOOR_W = 0.576, DOOR_H = H - 0.012, DOOR_T = 0.022;
  const doors = [-1, 1].map((side) => {
    const pivot = new Group();
    const hingeX = side * (W / 2 - T / 2);
    pivot.position.set(hingeX, PL + T / 2 + DOOR_H / 2 + 0.004, D / 2 + DOOR_T / 2 + 0.002);
    const door = new Mesh(new RoundedBoxGeometry(DOOR_W, DOOR_H, DOOR_T, 2, 0.004), M.door);
    door.castShadow = door.receiveShadow = true;
    door.position.x = -side * DOOR_W / 2;
    pivot.add(door);
    const handle = new Mesh(new RoundedBoxGeometry(0.016, 0.34, 0.026, 2, 0.006), M.gold);
    handle.castShadow = true;
    handle.position.set(-side * (DOOR_W / 2 - 0.05), 0, DOOR_T / 2 + 0.013); // perto da borda livre
    door.add(handle);
    scene.add(pivot);
    addGhost([DOOR_W, DOOR_H, DOOR_T], [hingeX - side * DOOR_W / 2, pivot.position.y, pivot.position.z], nextGhost());
    return { pivot, handle, side, final: pivot.position.clone(), a: side < 0 ? 0.56 : 0.58 };
  });

  // ---------- Câmera ----------
  let viewW = 1, viewH = 1, fitDist = 6;

  function resize() {
    viewW = Math.max(1, container.clientWidth);
    viewH = Math.max(1, container.clientHeight);
    renderer.setSize(viewW, viewH, false);
    const aspect = viewW / viewH;
    const wide = viewW >= 1024;
    camera.fov = aspect < 1 ? 46 : 32;
    camera.aspect = aspect;
    // Desktop: o móvel ocupa a metade direita (texto à esquerda).
    // Mobile/tablet: centralizado e um pouco abaixo.
    if (wide) camera.setViewOffset(viewW * 1.56, viewH, 0, 0, viewW, viewH);
    else camera.setViewOffset(viewW, viewH * 1.16, 0, 0, viewW, viewH);
    camera.updateProjectionMatrix();
    // Distância para o móvel (≈2,7 m de altura com folga de órbita) caber na área livre.
    const vt = Math.tan((camera.fov * Math.PI) / 360);
    const ht = vt * aspect;
    const [hFrac, wFrac] = wide ? [0.68, 0.33] : [0.58, 0.74];
    fitDist = Math.max(1.35 / (vt * hFrac), 1.05 / (ht * wFrac));
    fog();
  }
  function fog() {
    scene.fog = new Fog(C.stage, fitDist * 1.1, fitDist * 3.2);
  }

  function placeCamera(p) {
    const yaw = keyed([[0, 0.62], [0.32, -0.42], [0.58, 0.36], [0.84, 0.1], [1, 0]], p);
    const pitch = keyed([[0, 0.42], [0.45, 0.24], [0.85, 0.12], [1, 0.06]], p);
    const dist = fitDist * keyed([[0, 1.08], [0.55, 1.0], [0.86, 0.97], [1, 0.86]], p);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
  }

  // ---------- Aplicar progresso ----------
  function setProgress(p) {
    // Projeto: linhas desenhadas e depois esmaecendo
    for (const gh of ghosts) {
      const t = win(p, gh.a, gh.b);
      gh.line.geometry.setDrawRange(0, Math.floor((gh.count * t) / 2) * 2);
    }
    lineMat.opacity = keyed([[0, 1], [0.3, 1], [0.55, 0.22], [0.8, 0]], p);
    ghostGroup.visible = lineMat.opacity > 0.01;

    // Peças voando até o encaixe
    for (const pc of pieces) {
      const t = win(p, pc.a, pc.b);
      pc.obj.visible = t > 0;
      const e = pc.ease(t);
      pc.obj.position.copy(pc.final).addScaledVector(pc.from, 1 - e);
      pc.obj.rotation.set(pc.rot[0] * (1 - e), pc.rot[1] * (1 - e), pc.rot[2] * (1 - e));
    }

    // Portas: entram abertas (vindas da frente) e fecham girando na dobradiça
    for (const d of doors) {
      const tin = win(p, d.a, d.a + 0.06);
      const tclose = E.door(win(p, d.a + 0.05, d.a + 0.15));
      d.pivot.visible = tin > 0;
      const e = E.out(tin);
      d.pivot.position.set(d.final.x + d.side * 1.6 * (1 - e), d.final.y, d.final.z + 1.8 * (1 - e));
      d.pivot.rotation.y = d.side * 1.57 * (1 - tclose); // aberta 90° para fora
      const th = E.settle(win(p, 0.7, 0.75));
      d.handle.scale.set(1, Math.max(0.001, th), 1);
      d.handle.visible = th > 0;
    }

    // Acabamento: madeira, LED e feixe de luz
    uWood.value = smooth(win(p, 0.68, 0.8));
    const ledOn = smooth(win(p, 0.72, 0.8));
    M.led.emissiveIntensity = 3 * ledOn;
    ledLight.intensity = 1.1 * ledOn;
    led.visible = p > 0.45;
    const s = win(p, 0.79, 0.9);
    sweep.position.x = -4 + 8 * s;
    sweep.intensity = Math.sin(Math.PI * s) * 16;

    placeCamera(p);
    renderer.render(scene, camera);
  }

  resize();

  function dispose() {
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    envRT.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { canvas: renderer.domElement, setProgress, resize, dispose };
}
