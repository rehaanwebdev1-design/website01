(() => {
  const host = document.querySelector('.model');
  const message = document.querySelector('#message');
  const fileFallback = document.querySelector('#fileFallback');
  const watchFile = document.querySelector('#watchFile');
  const overviewSection = document.querySelector('.product-overview');
  const circularMask = document.querySelector('.circular-mask');
  const header2 = document.querySelector('.header-2');

  if (!window.THREE || !THREE.GLTFLoader || !window.gsap || !window.ScrollTrigger || !window.Lenis) {
    message.textContent = 'An animation library did not load. Check your internet connection and refresh.';
    message.classList.add('error');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ wheelMultiplier: 0.68 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 1000);
  const environmentCanvas = document.createElement('canvas');
  environmentCanvas.width = 512;
  environmentCanvas.height = 256;
  const env = environmentCanvas.getContext('2d');
  const envGradient = env.createLinearGradient(0, 0, 0, 256);
  envGradient.addColorStop(0, '#777b83');
  envGradient.addColorStop(0.48, '#34363b');
  envGradient.addColorStop(1, '#111216');
  env.fillStyle = envGradient;
  env.fillRect(0, 0, 512, 256);
  env.fillStyle = '#fff4d8';
  env.fillRect(60, 38, 42, 115);
  env.fillRect(200, 18, 62, 72);
  env.fillRect(362, 45, 35, 125);
  env.fillStyle = '#d7e5ff';
  env.fillRect(445, 58, 23, 92);
  const environment = new THREE.CanvasTexture(environmentCanvas);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.encoding = THREE.sRGBEncoding;
  scene.environment = environment;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const mobileViewport = () => window.matchMedia('(max-width: 700px)').matches;
  const renderRatio = () => Math.min(
    window.devicePixelRatio || 1,
    mobileViewport() ? 1.25 : 1.5,
  );
  renderer.setPixelRatio(renderRatio());
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = false;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff4df, 0x27242a, 0.9));
  const key = new THREE.DirectionalLight(0xffe7bd, 1.55);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb4c9ff, 1.3);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  let model;
  let currentScroll = 0;
  let scannerPosition = window.innerHeight * 2;
  const baseTiltX = 0.1;
  const baseTiltY = -0.2;
  let disposedObjectUrl;
  const loader = new THREE.GLTFLoader();

  function mergeStaticMeshes(root) {
    const mergeGeometries = THREE.BufferGeometryUtils?.mergeBufferGeometries;
    if (!mergeGeometries) return false;

    root.updateMatrixWorld(true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const groups = new Map();
    const sourceMeshes = [];
    let unsupportedMesh = false;

    root.traverse((node) => {
      if (!node.isMesh) return;
      if (node.isSkinnedMesh || node.morphTargetInfluences || Array.isArray(node.material)) {
        unsupportedMesh = true;
        return;
      }

      const geometry = node.geometry;
      const attributeKey = Object.keys(geometry.attributes)
        .sort()
        .map((name) => {
          const attribute = geometry.attributes[name];
          return `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`;
        })
        .join('|');
      const key = `${node.material.uuid}:${attributeKey}:${geometry.index ? 'indexed' : 'non-indexed'}`;
      if (!groups.has(key)) groups.set(key, { material: node.material, geometries: [], meshes: [] });

      const localGeometry = geometry.clone();
      const relativeMatrix = inverseRoot.clone().multiply(node.matrixWorld);
      localGeometry.applyMatrix4(relativeMatrix);
      localGeometry.clearGroups();
      const group = groups.get(key);
      group.geometries.push(localGeometry);
      group.meshes.push(node);
      sourceMeshes.push(node);
    });

    if (unsupportedMesh || groups.size === 0) {
      groups.forEach((group) => group.geometries.forEach((geometry) => geometry.dispose()));
      return false;
    }

    const mergedGroups = [];
    for (const group of groups.values()) {
      let geometry;
      try {
        geometry = mergeGeometries(group.geometries, false);
      } catch (error) {
        console.warn('Watch geometry optimization skipped:', error);
        groups.forEach((pending) => pending.geometries.forEach((item) => item.dispose()));
        mergedGroups.forEach((item) => item.geometry.dispose());
        return false;
      }
      if (!geometry) {
        groups.forEach((pending) => pending.geometries.forEach((item) => item.dispose()));
        mergedGroups.forEach((item) => item.geometry.dispose());
        return false;
      }
      mergedGroups.push({ geometry, material: group.material });
    }

    groups.forEach((group) => group.geometries.forEach((geometry) => geometry.dispose()));
    sourceMeshes.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    });
    mergedGroups.forEach(({ geometry, material }) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = true;
      root.add(mesh);
    });
    return true;
  }

  function handleLoaded(gltf) {
    model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const size = bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const verticalFit = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const horizontalFit = size.x / (2 * Math.tan(horizontalFov / 2));
    const distance = Math.max(verticalFit, horizontalFit, maxDimension * 0.5) * 1.62;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(maxDimension / 1000, 0.001);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();

    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if ('metalness' in material) material.envMapIntensity = 1.15;
      });
    });
    mergeStaticMeshes(model);

    model.scale.setScalar(1);
    model.rotation.set(baseTiltX, baseTiltY, 0);
    scene.add(model);
    scannerPosition = overviewSection.offsetTop;
    const firstTooltip = document.querySelectorAll('.tooltip:nth-child(1) .icon, .tooltip:nth-child(1) .title span, .tooltip:nth-child(1) .description p');
    const secondTooltip = document.querySelectorAll('.tooltip:nth-child(2) .icon, .tooltip:nth-child(2) .title span, .tooltip:nth-child(2) .description p');
    const dividers = document.querySelectorAll('.tooltip .divider');
    gsap.set([...firstTooltip, ...secondTooltip], { y: '125%' });
    gsap.set(dividers, { scaleX: 0 });
    gsap.timeline({
      scrollTrigger: {
        trigger: overviewSection,
        start: 'top top',
        end: 'bottom top',
        scrub: mobileViewport() ? true : 0.12,
      },
    })
      .to(circularMask, { clipPath: 'circle(100% at 50% 50%)', duration: 0.1, ease: 'none' }, 0.16)
      .fromTo(header2, { xPercent: 100 }, { xPercent: -200, duration: 0.25, ease: 'none' }, 0.1)
      .to(dividers, { scaleX: 1, duration: 0.12, ease: 'none' }, 0.34)
      .to(firstTooltip, { y: '0%', duration: 0.18, stagger: 0.035, ease: 'power2.out' }, 0.46)
      .to(secondTooltip, { y: '0%', duration: 0.18, stagger: 0.035, ease: 'power2.out' }, 0.72)
      .to(model.rotation, { y: baseTiltY + Math.PI * 4, duration: 0.85, ease: 'none' }, 0.05);

    overviewSection.classList.add('watch-ready');

    const storySection = document.querySelector('.story');
    const worthBridge = document.querySelector('.worth-bridge');
    if (storySection && worthBridge) {
      gsap.timeline({
        scrollTrigger: {
          trigger: storySection,
          start: 'top top',
          end: 'top -65%',
          scrub: mobileViewport() ? true : 0.12,
        },
      })
        .fromTo(worthBridge, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, 0)
        .to(worthBridge, { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in' }, 0.7);
    }

    ScrollTrigger.refresh();
    message.textContent = 'Scroll through the watch details and rotating view.';
    message.classList.remove('error');
    fileFallback.hidden = true;
    window.setTimeout(() => { message.textContent = ''; }, 4200);
    if (disposedObjectUrl) {
      URL.revokeObjectURL(disposedObjectUrl);
      disposedObjectUrl = undefined;
    }
  }

  function handleLoadError(error) {
    console.error(error);
    message.textContent = `Could not load the watch (${error?.message || 'request or parse error'}). Choose the GLB file below, or open this page through Live Server.`;
    message.classList.add('error');
    fileFallback.hidden = false;
  }

  function loadUrl(url) {
    loader.load(url, handleLoaded, undefined, handleLoadError);
  }
  loadUrl('./assets/josta.glb?v=8');
  watchFile.addEventListener('change', () => {
    const file = watchFile.files?.[0];
    if (!file) return;
    if (disposedObjectUrl) URL.revokeObjectURL(disposedObjectUrl);
    disposedObjectUrl = URL.createObjectURL(file);
    message.textContent = 'Loading selected watch…';
    message.classList.remove('error');
    loadUrl(disposedObjectUrl);
  });

  lenis.on('scroll', (event) => {
    currentScroll = event.scroll;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(renderRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    scannerPosition = overviewSection.offsetTop;
    ScrollTrigger.refresh();
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const motionClock = new THREE.Clock();
  function renderFrame() {
    if (document.hidden || !model) return;

    const elapsed = motionClock.getElapsedTime();
    currentScroll = lenis.scroll;
    const scrollProgress = Math.min(currentScroll / Math.max(scannerPosition, 1), 1);
    if (scrollProgress < 1) {
      const idleWeight = THREE.MathUtils.clamp(1 - currentScroll / window.innerHeight, 0, 1);
      model.position.y = Math.sin(scrollProgress * Math.PI * 2) * 0.12
        + Math.sin(elapsed * 0.8) * 0.035 * idleWeight;
      model.rotation.x = baseTiltX + scrollProgress * Math.PI * 2
        + Math.sin(elapsed * 0.55) * 0.012 * idleWeight;
      model.rotation.y = baseTiltY + Math.sin(elapsed * 0.42) * 0.035 * idleWeight;
    } else {
      model.position.y = 0;
    }
    renderer.render(scene, camera);
  }
  gsap.ticker.add(renderFrame);
})();
