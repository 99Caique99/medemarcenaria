// Cena 3D: armário planejado de 3 módulos montado em função do progresso p (0 → 1),
// que vai do início do "Sobre" até o rodapé. Tudo é função pura de p: o scrub
// funciona igual para frente, para trás e com rolagem rápida.
// O canvas é transparente: o móvel aparece sobre o fundo de cada seção.
// As etapas se sobrepõem de propósito: sempre há uma peça em movimento.
//
//   0.00–0.33  Estrutura   rodapé, base, laterais, fundo e tampo descem de fora do quadro e assentam
//   0.30–0.62  Interior    divisórias e prateleiras chegam pela frente e são empurradas para dentro
//   0.58–0.76  Portas      penduradas abertas nas dobradiças, fecham com amortecimento (soft-close)
//   0.66–0.86  Detalhes    parafusos (giram), puxadores e fita de LED
//   0.84–1.00  Entrega     brilho passa pelo verniz, luz quente de contorno
// Movimento "de mão": nenhuma peça surge do nada nem fica translúcida. Cada uma entra
// já sólida, vinda de fora do quadro, desacelera como algo carregado com cuidado,
// balança um pouco (pêndulo amortecido) e encaixa no último centímetro.
import {
  NeutralToneMapping, RepeatWrapping, BoxGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PCFShadowMap, PMREMGenerator, PerspectiveCamera,
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
  travel: gsap.parseEase('power3.out'),   // entra em movimento e desacelera até parar
  seat: gsap.parseEase('sine.inOut'),     // último centímetro: encaixe macio
  push: gsap.parseEase('power3.out'),
  close: gsap.parseEase('power3.inOut'),  // porta: embalo e freio do soft-close
  cam: gsap.parseEase('sine.inOut'),
};

// Altura (m) de onde as peças descem: acima do topo do quadro em qualquer ângulo da câmera.
const SKY = 4.2;

// UVs em metros (projeção por face), com o veio sempre no sentido do comprimento
// da face. Assim a densidade do veio é a mesma em todas as peças e as bordas
// (fita de borda) mostram o veio fino, como no MDF/lâmina real, em vez de uma
// textura inteira esmagada em 2 cm. Cada peça usa um trecho diferente da lâmina.
const TILE = 2.4;
function woodUV(geo, dims, seed) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const r = (k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const half = dims.map((d) => d / 2);
  for (let i = 0; i < pos.count; i++) {
    const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const ax = n[0] > n[1] && n[0] > n[2] ? 0 : n[1] > n[2] ? 1 : 2;
    const [a, b] = ax === 0 ? [2, 1] : ax === 1 ? [0, 2] : [0, 1];
    // eixo do veio: a maior dimensão da peça entre os dois eixos da face
    const [g, c] = dims[a] >= dims[b] ? [a, b] : [b, a];
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const lg = dims[g] / TILE, lc = dims[c] / TILE;
    const u = (p[g] + half[g]) / TILE + r(ax + 1) * Math.max(0, 1 - lg);
    const v = (p[c] + half[c]) / TILE + r(ax + 5) * Math.max(0, 1 - lc);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}
const woodBox = (dims, seed, radius = 0.003) =>
  woodUV(new RoundedBoxGeometry(dims[0], dims[1], dims[2], 3, Math.min(radius, Math.min(...dims) / 3)), dims, seed);

export async function createStage(container, { mobile }) {
  // ---------- Renderer (fundo transparente) ----------
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const maxDpr = Math.min(window.devicePixelRatio, mobile ? 2 : 1.5);
  renderer.setPixelRatio(maxDpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping; // cor da madeira fiel, sem o laranja saturado do ACES
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();
  await pause();

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const target = new Vector3(0, 1.2, 0);

  // ---------- Luz de estúdio ----------
  scene.add(new HemisphereLight('#fffaf2', '#8a7560', 0.28));
  // Luz principal de janela: alta, à frente e à direita; sombras macias que
  // entram no móvel (prateleiras sombreiam o fundo, portas sombreiam o chão).
  const key = new DirectionalLight('#fff0db', 2.1);
  key.position.set(1.4, 7, 5.6); // quase frontal: a sombra cai atrás do móvel, não espalhada de lado
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 3.2, bottom: -1.6, near: 2, far: 16 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = mobile ? 3 : 4;
  key.shadow.blurSamples = mobile ? 8 : 12;
  scene.add(key);
  const fill = new DirectionalLight('#f1e3d3', 0.32);
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
  const shadowCatcher = new Mesh(new PlaneGeometry(14, 14), new ShadowMaterial({ opacity: 0.26 }));
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
  // Lâmina de 2,4 m: veio fino e quase reto (corte radial), com catedrais suaves
  tex.carcass = await woodTexture({ base: '#74543a', dark: '#3a2a1f', light: '#a27a50', seed: 3, size, rings: 110, arch: 0.12, wave: 0.5, maxAnisotropy: aniso });
  tex.door = await woodTexture({ base: '#6e4c31', dark: '#2f2118', light: '#9c7247', seed: 11, size, rings: 90, arch: 0.18, wave: 0.6, maxAnisotropy: aniso });
  tex.back = await woodTexture({ base: '#5a4636', dark: '#33281f', light: '#7c5e44', seed: 9, size: 512, rings: 50, vertical: true, shade: 0.45, maxAnisotropy: aniso });
  tex.carcass.wrapS = tex.carcass.wrapT = tex.door.wrapS = tex.door.wrapT = RepeatWrapping;
  // Materiais compartilhados (opacos): menos programas e trocas de estado na GPU.
  const mats = {
    carcass: new MeshStandardMaterial({ map: tex.carcass, bumpMap: tex.carcass, bumpScale: 0.15, roughness: 0.52 }),
    back: new MeshStandardMaterial({ map: tex.back, bumpMap: tex.back, bumpScale: 0.1, roughness: 0.7 }),
    // Verniz: reflexo nítido da sala por cima do veio fosco
    door: new MeshPhysicalMaterial({
      map: tex.door, bumpMap: tex.door, bumpScale: 0.15, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.16,
    }),
  };
  const gold = new MeshStandardMaterial({ color: C.goldDeep, metalness: 1, roughness: 0.22, envMapIntensity: 1.4 });
  const ledMat = new MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0 });

  // ---------- Peças ----------
  const pieces = [];

  // Trajeto de cada peça (tudo relativo à posição final):
  //   from:  de onde vem, fora do quadro (desce do alto ou chega pelo alto/à frente)
  //   seat:  o último trecho, ao longo do eixo de montagem (encaixe), em metros
  //   sway:  balanço inicial (rad) que se amortece até zero, como algo pendurado
  let seedN = 1;
  function piece(name, dims, pos, kind, { from, seat = [0, 0.03, 0], sway = [0, 0, 0], a, b }) {
    // O fundo usa a lâmina inteira (tem a oclusão das bordas "assada" na imagem)
    const geo = kind === 'back' ? new RoundedBoxGeometry(...dims, 3, 0.003) : woodBox(dims, seedN);
    seedN++;
    const mesh = new Mesh(geo, mats[kind]);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    const final = new Vector3(...pos);
    pieces.push({ mesh, final, from: new Vector3(...from), seat: new Vector3(...seat), sway, a, b });
    return mesh;
  }
  const drop = (y, dx = 0, dz = 0) => [dx, SKY - y, dz]; // desce do alto até a posição final

  // Estrutura: tudo desce de cima, cada peça no seu tempo
  const yR = PL / 2, yB = PL + T / 2, yS = PL + H / 2, yT = PL + H + T / 2;
  piece('rodape', [W - 0.08, PL, D - 0.08], [0, yR, -0.02], 'carcass', { from: drop(yR), sway: [0.03, 0, 0.02], a: 0, b: 0.08 });
  piece('base', [W, T, D], [0, yB, 0], 'carcass', { from: drop(yB), sway: [0.04, 0, -0.025], a: 0.035, b: 0.12 });
  piece('lateral-esq', [T, H, D], [-(W / 2 - T / 2), yS, 0], 'carcass', { from: drop(yS, -0.12), seat: [-0.03, 0.04, 0], sway: [0, 0, 0.06], a: 0.08, b: 0.18 });
  piece('lateral-dir', [T, H, D], [W / 2 - T / 2, yS, 0], 'carcass', { from: drop(yS, 0.12), seat: [0.03, 0.04, 0], sway: [0, 0, -0.06], a: 0.12, b: 0.22 });
  // Fundo: corre de cima para baixo no canal das laterais (sem balanço: está guiado)
  piece('fundo', [W - 2 * T, INNER_H, 0.012], [0, INNER_Y + INNER_H / 2, -D / 2 + 0.006], 'back', { from: drop(INNER_Y + INNER_H / 2), seat: [0, 0.25, 0], a: 0.17, b: 0.27 });
  piece('tampo', [W + 0.03, T, D + 0.03], [0, yT, 0], 'carcass', { from: drop(yT), sway: [0.035, 0, 0.02], a: 0.23, b: 0.33 });

  // Interior: chega pelo alto, à frente da abertura, e é empurrado para dentro;
  // as prateleiras descem o último centímetro sobre os pinos.
  const front = (y, z = 1.1) => [0, Math.max(0.4, SKY - 0.6 - y), z];
  [-DIV_X, DIV_X].forEach((x, i) => {
    const y = INNER_Y + INNER_H / 2;
    piece(`divisoria-${i + 1}`, [T, INNER_H, D - 0.03], [x, y, -0.015], 'carcass', { from: front(y), seat: [0, 0.004, 0.32], sway: [0, 0, 0.03 * (i ? -1 : 1)], a: 0.3 + i * 0.04, b: 0.39 + i * 0.04 });
  });
  [[0, 0.25], [0, 0.5], [0, 0.75], [-SIDE_X, 0.36], [SIDE_X, 0.36], [-SIDE_X, 0.68], [SIDE_X, 0.68]].forEach(([x, k], i) => {
    const a = 0.4 + i * 0.025, y = INNER_Y + INNER_H * k;
    piece(`prateleira-${i + 1}`, [MOD_W, 0.025, D - 0.05], [x, y, -0.01], 'carcass', { from: front(y, 0.9), seat: [0, 0.012, 0.3], sway: [0.02, 0, 0.015], a, b: a + 0.075 });
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
    const door = new Mesh(woodBox([DOOR_W, DOOR_H, DOOR_T], 40 + i), mats.door);
    door.receiveShadow = true;
    door.castShadow = true;
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
    return { pivot, door, handle, side, final: pivot.position.clone(), a: 0.58 + i * 0.04 };
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
    const fill = mobile ? 0.84 : 0.86;
    fitDist = Math.max(1.42 / (vt * fill), 1.12 / (vt * aspect * fill));
    // Na faixa do celular o pé da faixa é um degradê sobre o texto: o móvel sobe
    // um pouco no quadro para ficar inteiro na parte sólida.
    if (mobile) camera.setViewOffset(w, h, 0, h * 0.07, w, h);
    else camera.clearViewOffset();
  }

  // Câmera de cinema: um único arco lento, sempre no mesmo sentido (sem vai e vem),
  // de três quartos e do alto até quase de frente, aproximando de leve no fim.
  function placeCamera(p) {
    const e = E.cam(p);
    const yaw = 0.62 - 0.54 * e;
    const pitch = 0.3 - 0.2 * e;
    const dist = fitDist * (1.06 - 0.1 * smooth(p));
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
      pc.mesh.visible = t > 0;
      if (!pc.mesh.visible) continue;
      const travel = 1 - E.travel(win(t, 0, 0.8));
      const seat = 1 - E.seat(win(t, 0.62, 1));
      pc.mesh.position.copy(pc.final).addScaledVector(pc.from, travel).addScaledVector(pc.seat, seat);
      // longe do móvel a sombra projetada seria só uma mancha solta no chão
      pc.mesh.castShadow = travel < 0.2;
      // pêndulo amortecido: ~1,5 oscilação, some por completo ao assentar
      const sw = Math.cos(t * Math.PI * 3) * (1 - t) ** 2;
      pc.mesh.rotation.set(pc.sway[0] * sw, pc.sway[1] * sw, pc.sway[2] * sw);
    }
    contact.material.opacity = smooth(win(p, 0, 0.14));

    for (const d of doors) {
      // chega aberta pelo alto, encaixa a dobradiça e fecha com soft-close
      const tin = win(p, d.a, d.a + 0.07);
      d.pivot.visible = tin > 0;
      const travel = 1 - E.travel(win(tin, 0, 0.8));
      const seat = 1 - E.seat(win(tin, 0.6, 1));
      d.door.castShadow = travel < 0.2;
      d.pivot.position.set(
        d.final.x + d.side * 0.1 * travel,
        d.final.y + (SKY - d.final.y) * travel + 0.02 * seat,
        d.final.z + 0.35 * travel + 0.03 * seat,
      );
      const tc = win(p, d.a + 0.06, d.a + 0.15);
      // embalo, freio hidráulico nos últimos graus e um assentamento mínimo
      const ang = (Math.PI / 2) * (1 - E.close(tc)) + Math.sin(Math.PI * clamp01((tc - 0.8) / 0.2)) * 0.012;
      d.pivot.rotation.y = d.side * ang;
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

  const pixelRatio = () => renderer.getPixelRatio();
  function setPixelRatio(r) { renderer.setPixelRatio(r); resize(); }

  return { setProgress, resize, dispose, pixelRatio, setPixelRatio };
}
