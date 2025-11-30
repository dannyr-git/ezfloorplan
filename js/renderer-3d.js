import * as state from './state.js';
import * as dom from './dom.js';
import { parseLengthToInches, lineKind } from './utils.js';

// === Helper: Find elements on a wall ==============================

function getElementsOnWall(wall, lines) {
  const elementsOnWall = [];
  const wdx = wall.x2 - wall.x1;
  const wdy = wall.y2 - wall.y1;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen === 0) return elementsOnWall;

  const wux = wdx / wlen;
  const wuy = wdy / wlen;

  for (const el of lines) {
    const kind = lineKind(el);
    if (kind === "wall") continue;

    const elemMidX = (el.x1 + el.x2) / 2;
    const elemMidY = (el.y1 + el.y2) / 2;

    // Project to wall
    const t = ((elemMidX - wall.x1) * wux + (elemMidY - wall.y1) * wuy);
    if (t < -5 || t > wlen + 5) continue;

    // Check if close to wall
    const closestX = wall.x1 + wux * t;
    const closestY = wall.y1 + wuy * t;
    const dist = Math.sqrt((elemMidX - closestX) ** 2 + (elemMidY - closestY) ** 2);

    if (dist < 10) {
      const t1 = ((el.x1 - wall.x1) * wux + (el.y1 - wall.y1) * wuy);
      const t2 = ((el.x2 - wall.x1) * wux + (el.y2 - wall.y1) * wuy);
      elementsOnWall.push({
        element: el,
        kind: kind,
        tStart: Math.min(t1, t2),
        tEnd: Math.max(t1, t2),
      });
    }
  }

  // Sort by position along wall
  elementsOnWall.sort((a, b) => a.tStart - b.tStart);
  return elementsOnWall;
}

// === 3D Scene with Three.js ======================================

export function generate3DScene() {
  const threeContainer = dom.getThreeContainer();
  const threeCloseBtn = dom.getThreeCloseBtn();
  const wallThicknessInput = dom.getWallThicknessInput();
  const ceilingHeightInput = dom.getCeilingHeightInput();
  const doorTrimInput = dom.getDoorTrimInput();
  const windowTrimInput = dom.getWindowTrimInput();

  threeContainer.style.display = "block";
  threeContainer.innerHTML = "";
  threeContainer.appendChild(threeCloseBtn);

  if (typeof THREE === "undefined") {
    const msg = document.createElement("div");
    msg.className = "three-message";
    msg.textContent =
      "Three.js (3D library) is not available in this environment, so a full 3D scene can't be rendered. The 2D editor still works normally.";
    threeContainer.appendChild(msg);
    return;
  }

  const width = threeContainer.clientWidth;
  const height = threeContainer.clientHeight;

  const threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(width, height);
  threeContainer.appendChild(threeRenderer.domElement);
  state.setThreeRenderer(threeRenderer);

  const threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x111111);
  state.setThreeScene(threeScene);

  const threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
  state.setThreeCamera(threeCamera);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  threeScene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0, 1000, 500);
  threeScene.add(dirLight);

  // Bounds
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const l of state.getLines()) {
    minX = Math.min(minX, l.x1, l.x2);
    maxX = Math.max(maxX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxY = Math.max(maxY, l.y1, l.y2);
  }
  if (!isFinite(minX)) {
    minX = -200;
    maxX = 200;
    minY = -200;
    maxY = 200;
  }
  // Use X directly, Y becomes Z (no flipping - matches 2D top-down view)
  const centerX = (minX + maxX) / 2;
  const centerZ = (minY + maxY) / 2;
  const sizeX = Math.max(maxX - minX, 200);
  const sizeY = Math.max(maxY - minY, 200);
  const radius = Math.max(sizeX, sizeY) * 1.4;

  let wallThickness = parseFloat(wallThicknessInput.value);
  if (!isFinite(wallThickness) || wallThickness <= 0) wallThickness = 6;

  let ceilingInches =
    parseLengthToInches(ceilingHeightInput.value || "") || 96;
  if (!isFinite(ceilingInches) || ceilingInches <= 0) ceilingInches = 96;

  let doorTrim = parseLengthToInches(doorTrimInput.value || "");
  if (!doorTrim || !isFinite(doorTrim) || doorTrim < 0) doorTrim = 0;
  let windowTrim = parseLengthToInches(windowTrimInput.value || "");
  if (!windowTrim || !isFinite(windowTrim) || windowTrim < 0)
    windowTrim = 0;

  // Floor
  const floorGeom = new THREE.PlaneGeometry(sizeX * 1.5, sizeY * 1.5);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  threeScene.add(floor);

  const lines = state.getLines();
  const wallColliders = [];

  // Helper to create trim frame group
  function createTrimGroup(width, height, trimSize, depth, color) {
    if (!trimSize || trimSize <= 0) return null;
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color });

    const topGeom = new THREE.BoxGeometry(width, trimSize, depth);
    const bottomGeom = topGeom.clone();
    const sideGeom = new THREE.BoxGeometry(trimSize, height, depth);

    const top = new THREE.Mesh(topGeom, material);
    top.position.y = height / 2 - trimSize / 2;
    group.add(top);

    const bottom = new THREE.Mesh(bottomGeom, material);
    bottom.position.y = -height / 2 + trimSize / 2;
    group.add(bottom);

    const left = new THREE.Mesh(sideGeom, material);
    left.position.x = -width / 2 + trimSize / 2;
    group.add(left);

    const right = new THREE.Mesh(sideGeom.clone(), material);
    right.position.x = width / 2 - trimSize / 2;
    group.add(right);

    return group;
  }

  // Compute centroid for default direction
  let sumX = 0, sumY = 0, count = 0;
  for (const l of lines) {
    if (lineKind(l) !== "wall") continue;
    sumX += l.x1 + l.x2;
    sumY += l.y1 + l.y2;
    count += 2;
  }
  const centroidX = count > 0 ? sumX / count : 0;
  const centroidY = count > 0 ? sumY / count : 0;

  for (const l of lines) {
    const kind = lineKind(l);
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) continue;

    // Wall midpoint (the face)
    const midX = (l.x1 + l.x2) / 2;
    const midY = (l.y1 + l.y2) / 2;

    // Normal vector (perpendicular to wall)
    let nx = -dy / length;
    let ny = dx / length;

    // Unit vectors along wall
    const ux = dx / length;
    const uy = dy / length;

    // Default: wall extends away from centroid
    const toCentroidX = centroidX - midX;
    const toCentroidY = centroidY - midY;
    const dot = nx * toCentroidX + ny * toCentroidY;

    if (dot > 0) {
      nx = -nx;
      ny = -ny;
    }

    // Apply manual flip if set
    if (l.facingFlipped) {
      nx = -nx;
      ny = -ny;
    }

    // Center of wall box (offset by half thickness behind the face)
    const centerWx = midX + nx * (wallThickness / 2);
    const centerWy = midY + ny * (wallThickness / 2);

    // Convert to 3D coordinates
    const centerW3dX = centerWx;
    const centerW3dZ = centerWy;

    // Angle in 3D
    const angle = -Math.atan2(dy, dx);

    if (kind === "wall") {
      const elementsOnWall = getElementsOnWall(l, lines);

      // Track wall collider for walk mode
      const wallCollider = {
        startX: l.x1,
        startY: l.y1,
        ux,
        uy,
        nx,
        ny,
        length,
        thickness: wallThickness,
        openings: [],
      };
      wallColliders.push(wallCollider);

      if (elementsOnWall.length === 0) {
        const geom = new THREE.BoxGeometry(length, ceilingInches, wallThickness);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(centerW3dX, ceilingInches / 2, centerW3dZ);
        mesh.rotation.y = angle;
        threeScene.add(mesh);
      } else {
        let currentT = 0;

        for (const elem of elementsOnWall) {
          const elHeight = elem.element.heightInches || (elem.kind === "door" ? 80 : 48);
          const elBaseOffset = elem.element.baseOffsetInches != null ? elem.element.baseOffsetInches : (elem.kind === "door" ? 0 : 36);

          if (elem.kind === "door") {
            wallCollider.openings.push({
              tStart: elem.tStart,
              tEnd: elem.tEnd,
              base: elBaseOffset,
              height: elHeight,
            });
          }

          if (elem.tStart > currentT + 1) {
            const segLen = elem.tStart - currentT;
            const segCenterT = currentT + segLen / 2;
            const segCenterX = l.x1 + ux * segCenterT + nx * (wallThickness / 2);
            const segCenterY = l.y1 + uy * segCenterT + ny * (wallThickness / 2);

            const geom = new THREE.BoxGeometry(segLen, ceilingInches, wallThickness);
            const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(segCenterX, ceilingInches / 2, segCenterY);
            mesh.rotation.y = angle;
            threeScene.add(mesh);
          }

          const openingLen = elem.tEnd - elem.tStart;
          const openingCenterT = (elem.tStart + elem.tEnd) / 2;
          const openingCenterX = l.x1 + ux * openingCenterT + nx * (wallThickness / 2);
          const openingCenterY = l.y1 + uy * openingCenterT + ny * (wallThickness / 2);

          const topOfOpening = elBaseOffset + elHeight;
          if (topOfOpening < ceilingInches - 1) {
            const aboveHeight = ceilingInches - topOfOpening;
            const geom = new THREE.BoxGeometry(openingLen, aboveHeight, wallThickness);
            const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(openingCenterX, topOfOpening + aboveHeight / 2, openingCenterY);
            mesh.rotation.y = angle;
            threeScene.add(mesh);
          }

          if (elBaseOffset > 1) {
            const geom = new THREE.BoxGeometry(openingLen, elBaseOffset, wallThickness);
            const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(openingCenterX, elBaseOffset / 2, openingCenterY);
            mesh.rotation.y = angle;
            threeScene.add(mesh);
          }

          currentT = elem.tEnd;
        }

        if (currentT < length - 1) {
          const segLen = length - currentT;
          const segCenterT = currentT + segLen / 2;
          const segCenterX = l.x1 + ux * segCenterT + nx * (wallThickness / 2);
          const segCenterY = l.y1 + uy * segCenterT + ny * (wallThickness / 2);

          const geom = new THREE.BoxGeometry(segLen, ceilingInches, wallThickness);
          const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(segCenterX, ceilingInches / 2, segCenterY);
          mesh.rotation.y = angle;
          threeScene.add(mesh);
        }
      }
    } else if (kind === "door" || kind === "window") {
      const doorWindowDx = l.x2 - l.x1;
      const doorWindowDy = l.y2 - l.y1;
      const doorWindowLength = Math.sqrt(doorWindowDx * doorWindowDx + doorWindowDy * doorWindowDy);

      const height = l.heightInches || (kind === "door" ? 80 : 48);
      const baseOffset = l.baseOffsetInches != null ? l.baseOffsetInches : (kind === "door" ? 0 : 36);
      const yCenter = baseOffset + height / 2;

      const elemCenterX = midX;
      const elemCenterY = midY;

      const elementGroup = new THREE.Group();
      elementGroup.position.set(elemCenterX, yCenter, elemCenterY);
      elementGroup.rotation.y = angle;
      threeScene.add(elementGroup);

      if (kind === "door") {
        const trimDepth = Math.max(wallThickness * 0.4, 0.5);
        const panelWidth = Math.max(doorWindowLength - 2 * doorTrim, doorWindowLength * 0.65);
        const panelHeight = Math.max(height - doorTrim, height * 0.9);
        const panelThickness = Math.max(wallThickness * 0.2, 1.2);

        if (doorTrim > 0) {
          const frontTrim = createTrimGroup(doorWindowLength, height, doorTrim, trimDepth, 0xD2B48C);
          if (frontTrim) {
            frontTrim.position.z = wallThickness / 2 - trimDepth / 2;
            elementGroup.add(frontTrim);

            const backTrim = createTrimGroup(doorWindowLength, height, doorTrim, trimDepth, 0xD2B48C);
            backTrim.position.z = -frontTrim.position.z;
            elementGroup.add(backTrim);
          }
        }

        const doorGeom = new THREE.BoxGeometry(panelWidth, panelHeight, panelThickness);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.6 });
        const doorMesh = new THREE.Mesh(doorGeom, doorMat);
        elementGroup.add(doorMesh);

        const insetGeom = new THREE.BoxGeometry(panelWidth * 0.8, panelHeight * 0.4, panelThickness * 0.6);
        const insetMat = new THREE.MeshStandardMaterial({ color: 0x734320, roughness: 0.5 });
        const insetMesh = new THREE.Mesh(insetGeom, insetMat);
        insetMesh.position.z = panelThickness * 0.15;
        elementGroup.add(insetMesh);

        const knobHeightWorld = baseOffset + 36;
        const knobLocalY = knobHeightWorld - yCenter;
        const knobLocalX = panelWidth / 2 - 4;
        const knobDepth = panelThickness / 2 + 0.5;
        const knobMaterial = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.9, roughness: 0.2 });
        const knobMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 18), knobMaterial);
        knobMesh.position.set(knobLocalX, knobLocalY, knobDepth);
        elementGroup.add(knobMesh);

        const handleGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.8, 16);
        const handleMesh = new THREE.Mesh(handleGeom, knobMaterial);
        handleMesh.rotation.x = Math.PI / 2;
        handleMesh.position.set(knobLocalX, knobLocalY, knobDepth + 1.4);
        elementGroup.add(handleMesh);
      } else {
        const trimDepth = Math.max(wallThickness * 0.35, 0.4);
        const sashWidth = Math.max(doorWindowLength - 2 * windowTrim, doorWindowLength * 0.7);
        const sashHeight = Math.max(height - 2 * windowTrim, height * 0.7);
        const sashThickness = Math.max(wallThickness * 0.15, 0.6);

        if (windowTrim > 0) {
          const frontTrim = createTrimGroup(doorWindowLength, height, windowTrim, trimDepth, 0xD7B98F);
          if (frontTrim) {
            frontTrim.position.z = wallThickness / 2 - trimDepth / 2;
            elementGroup.add(frontTrim);

            const backTrim = createTrimGroup(doorWindowLength, height, windowTrim, trimDepth, 0xD7B98F);
            backTrim.position.z = -frontTrim.position.z;
            elementGroup.add(backTrim);
          }
        }

        const sashGeom = new THREE.BoxGeometry(sashWidth, sashHeight, sashThickness);
        const sashMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F5, roughness: 0.8 });
        const sashMesh = new THREE.Mesh(sashGeom, sashMat);
        elementGroup.add(sashMesh);

        const glassGeom = new THREE.PlaneGeometry(Math.max(sashWidth - 3, 1), Math.max(sashHeight - 3, 1));
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xA8D8FF,
          transparent: true,
          opacity: 0.35,
          metalness: 0.05,
          roughness: 0.1,
          side: THREE.DoubleSide,
        });
        const glassMesh = new THREE.Mesh(glassGeom, glassMat);
        glassMesh.position.z = 0.05;
        elementGroup.add(glassMesh);

        const muntinMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, roughness: 0.4 });
        const muntinThickness = 0.5;
        const verticalCount = 2;
        for (let i = 1; i <= verticalCount; i++) {
          const offset = (i - (verticalCount + 1) / 2) * (sashWidth / (verticalCount + 1));
          const vertGeom = new THREE.BoxGeometry(muntinThickness, Math.max(sashHeight - 1, 1), 0.6);
          const vertMesh = new THREE.Mesh(vertGeom, muntinMat);
          vertMesh.position.x = offset;
          elementGroup.add(vertMesh);
        }
        const horizGeom = new THREE.BoxGeometry(Math.max(sashWidth - 1, 1), muntinThickness, 0.6);
        const horizMesh = new THREE.Mesh(horizGeom, muntinMat);
        elementGroup.add(horizMesh);

        const sillHeight = Math.max(windowTrim, 2);
        const sillDepth = Math.min(wallThickness, 12);
        const sillGeom = new THREE.BoxGeometry(doorWindowLength, sillHeight, sillDepth);
        const sillMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.2, roughness: 0.6 });
        const sillMesh = new THREE.Mesh(sillGeom, sillMat);
        sillMesh.position.y = -sashHeight / 2 - sillHeight / 2;
        sillMesh.position.z = wallThickness / 2 - sillDepth / 2;
        elementGroup.add(sillMesh);
      }
    }
  }

  // Camera positioning
  threeCamera.position.set(
    centerX + radius,
    ceilingInches * 1.2,
    centerZ + radius
  );
  threeCamera.lookAt(centerX, 0, centerZ);

  // Store orbit data
  threeCamera.orbitCenter = new THREE.Vector3(centerX, 0, centerZ);
  threeCamera.orbitRadius = radius;
  threeCamera.orbitPhi = Math.atan2(
    threeCamera.position.z - threeCamera.orbitCenter.z,
    threeCamera.position.x - threeCamera.orbitCenter.x
  );
  threeCamera.orbitTheta = Math.asin(
    (threeCamera.position.y - threeCamera.orbitCenter.y) / radius
  );

  // Animation loop
  function renderThreeLoop() {
    threeRenderer.render(threeScene, threeCamera);
    requestAnimationFrame(renderThreeLoop);
  }
  renderThreeLoop();

  // === Walk Mode ===
  let walkMode = false;
  let walkYaw = 0;
  let walkPitch = 0;
  const eyeHeight = 72;
  const walkSpeed = 10;
  const walkRadius = 10;
  const keysPressed = new Set();

  let isMouseDownThree = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  const pointerElement = threeRenderer.domElement;
  let pointerLocked = false;

  const pointerLockChangeHandler = () => {
    pointerLocked = document.pointerLockElement === pointerElement;
    if (!pointerLocked && walkMode) {
      exitWalkMode();
    }
  };

  if (threeContainer._pointerLockHandler) {
    document.removeEventListener('pointerlockchange', threeContainer._pointerLockHandler);
  }
  threeContainer._pointerLockHandler = pointerLockChangeHandler;
  document.addEventListener('pointerlockchange', pointerLockChangeHandler);

  threeContainer.addEventListener("mousedown", (e) => {
    if (walkMode) {
      e.preventDefault();
      if (pointerElement.requestPointerLock) {
        pointerElement.requestPointerLock();
      }
      return;
    }
    isMouseDownThree = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  threeContainer.addEventListener("mousemove", (e) => {
    if (walkMode) {
      if (!pointerLocked) return;
      const deltaX = e.movementX || 0;
      const deltaY = e.movementY || 0;
      const lookSpeed = 0.0025;
      walkYaw -= deltaX * lookSpeed;
      walkPitch -= deltaY * lookSpeed;
      walkPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, walkPitch));
      updateWalkCamera();
      return;
    }

    if (!isMouseDownThree) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (!threeCamera.orbitCenter) return;

    const rotationSpeed = 0.01;
    threeCamera.orbitPhi -= deltaX * rotationSpeed;
    threeCamera.orbitTheta += deltaY * rotationSpeed;

    const maxTheta = Math.PI / 2 - 0.1;
    threeCamera.orbitTheta = Math.max(-maxTheta, Math.min(maxTheta, threeCamera.orbitTheta));

    const x =
      threeCamera.orbitCenter.x +
      threeCamera.orbitRadius * Math.cos(threeCamera.orbitTheta) * Math.cos(threeCamera.orbitPhi);
    const y =
      threeCamera.orbitCenter.y +
      threeCamera.orbitRadius * Math.sin(threeCamera.orbitTheta);
    const z =
      threeCamera.orbitCenter.z +
      threeCamera.orbitRadius * Math.cos(threeCamera.orbitTheta) * Math.sin(threeCamera.orbitPhi);

    threeCamera.position.set(x, y, z);
    threeCamera.lookAt(threeCamera.orbitCenter);
  });

  threeContainer.addEventListener("mouseup", () => {
    isMouseDownThree = false;
  });

  threeContainer.addEventListener("mouseleave", () => {
    isMouseDownThree = false;
  });

  // Wheel zoom (orbit mode only)
  threeContainer.addEventListener("wheel", (e) => {
    if (walkMode || !threeCamera.orbitCenter) return;
    e.preventDefault();
    const zoomSpeed = 0.1;
    const zoomFactor = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
    threeCamera.orbitRadius *= zoomFactor;
    threeCamera.orbitRadius = Math.max(50, Math.min(5000, threeCamera.orbitRadius));

    const x =
      threeCamera.orbitCenter.x +
      threeCamera.orbitRadius * Math.cos(threeCamera.orbitTheta) * Math.cos(threeCamera.orbitPhi);
    const y =
      threeCamera.orbitCenter.y +
      threeCamera.orbitRadius * Math.sin(threeCamera.orbitTheta);
    const z =
      threeCamera.orbitCenter.z +
      threeCamera.orbitRadius * Math.cos(threeCamera.orbitTheta) * Math.sin(threeCamera.orbitPhi);

    threeCamera.position.set(x, y, z);
    threeCamera.lookAt(threeCamera.orbitCenter);
  }, { passive: false });

  let savedOrbitState = null;

  function updateWalkCamera() {
    const lookX = Math.sin(walkYaw) * Math.cos(walkPitch);
    const lookY = Math.sin(walkPitch);
    const lookZ = Math.cos(walkYaw) * Math.cos(walkPitch);

    const target = new THREE.Vector3(
      threeCamera.position.x + lookX * 100,
      threeCamera.position.y + lookY * 100,
      threeCamera.position.z + lookZ * 100
    );
    threeCamera.lookAt(target);
  }

  function isPositionColliding(targetX, targetZ) {
    for (const wall of wallColliders) {
      const relX = targetX - wall.startX;
      const relZ = targetZ - wall.startY;
      const t = relX * wall.ux + relZ * wall.uy;
      if (t < -walkRadius || t > wall.length + walkRadius) continue;

      const dist = Math.abs(relX * wall.nx + relZ * wall.ny);
      const clearance = wall.thickness / 2 + walkRadius;
      if (dist >= clearance) continue;

      let blocked = true;
      for (const opening of wall.openings) {
        if (
          t >= opening.tStart - walkRadius &&
          t <= opening.tEnd + walkRadius &&
          eyeHeight >= opening.base &&
          eyeHeight <= opening.base + opening.height
        ) {
          blocked = false;
          break;
        }
      }

      if (blocked) {
        return true;
      }
    }
    return false;
  }

  function wouldCollide(deltaX, deltaZ) {
    const nextX = threeCamera.position.x + deltaX;
    const nextZ = threeCamera.position.z + deltaZ;
    return isPositionColliding(nextX, nextZ);
  }

  function handleWalkMovement() {
    if (!walkMode) return;

    const forwardX = Math.sin(walkYaw);
    const forwardZ = Math.cos(walkYaw);
    const rightX = Math.cos(walkYaw);
    const rightZ = -Math.sin(walkYaw);

    let moveX = 0, moveZ = 0;

    if (keysPressed.has('ArrowUp') || keysPressed.has('KeyW')) {
      moveX += forwardX * walkSpeed;
      moveZ += forwardZ * walkSpeed;
    }
    if (keysPressed.has('ArrowDown') || keysPressed.has('KeyS')) {
      moveX -= forwardX * walkSpeed;
      moveZ -= forwardZ * walkSpeed;
    }
    if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) {
      moveX -= rightX * walkSpeed;
      moveZ -= rightZ * walkSpeed;
    }
    if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) {
      moveX += rightX * walkSpeed;
      moveZ += rightZ * walkSpeed;
    }

    if (moveX !== 0 || moveZ !== 0) {
      let nextX = threeCamera.position.x;
      let nextZ = threeCamera.position.z;

      if (!wouldCollide(moveX, moveZ)) {
        nextX += moveX;
        nextZ += moveZ;
      } else {
        if (!wouldCollide(moveX, 0)) {
          nextX += moveX;
        }
        if (!wouldCollide(0, moveZ)) {
          nextZ += moveZ;
        }
      }

      if (nextX !== threeCamera.position.x || nextZ !== threeCamera.position.z) {
        threeCamera.position.x = nextX;
        threeCamera.position.z = nextZ;
        updateWalkCamera();
      }
    }
  }

  let walkAnimationId = null;
  function walkLoop() {
    handleWalkMovement();
    walkAnimationId = requestAnimationFrame(walkLoop);
  }
  walkLoop();

  function enterWalkMode() {
    walkMode = true;
    savedOrbitState = {
      position: threeCamera.position.clone(),
      orbitCenter: threeCamera.orbitCenter.clone(),
      orbitRadius: threeCamera.orbitRadius,
      orbitPhi: threeCamera.orbitPhi,
      orbitTheta: threeCamera.orbitTheta
    };

    threeCamera.position.set(centerX, eyeHeight, centerZ);
    walkYaw = 0;
    walkPitch = 0;
    updateWalkCamera();

    if (pointerElement.requestPointerLock) {
      pointerElement.requestPointerLock();
    }

    showWalkModeIndicator(true);
  }

  function exitWalkMode() {
    walkMode = false;
    if (pointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
    keysPressed.clear();
    if (savedOrbitState) {
      threeCamera.position.copy(savedOrbitState.position);
      threeCamera.orbitCenter = savedOrbitState.orbitCenter;
      threeCamera.orbitRadius = savedOrbitState.orbitRadius;
      threeCamera.orbitPhi = savedOrbitState.orbitPhi;
      threeCamera.orbitTheta = savedOrbitState.orbitTheta;
      threeCamera.lookAt(threeCamera.orbitCenter);
    }
    showWalkModeIndicator(false);
  }

  function showWalkModeIndicator(show) {
    let indicator = document.getElementById('walkModeIndicator');
    if (show) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'walkModeIndicator';
        indicator.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:4px;font-family:sans-serif;font-size:14px;z-index:1000;';
        indicator.innerHTML = '👁️ Walk Mode (6\' view) — WASD/Arrows to move, Mouse (pointer lock) to look, Space/Esc to exit';
        threeContainer.appendChild(indicator);
      }
      indicator.style.display = 'block';
    } else {
      if (indicator) {
        indicator.style.display = 'none';
      }
    }
  }

  function handleKeyDown(e) {
    if (threeContainer.style.display === 'none') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (walkMode) {
        exitWalkMode();
      } else {
        enterWalkMode();
      }
      return;
    }

    if (walkMode) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        keysPressed.add(e.code);
      }
    }
  }

  function handleKeyUp(e) {
    keysPressed.delete(e.code);
  }

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

export function close3DScene() {
  const threeContainer = dom.getThreeContainer();
  threeContainer.style.display = "none";

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  if (threeContainer._pointerLockHandler) {
    document.removeEventListener('pointerlockchange', threeContainer._pointerLockHandler);
    delete threeContainer._pointerLockHandler;
  }

  const indicator = document.getElementById('walkModeIndicator');
  if (indicator) {
    indicator.remove();
  }

  if (state.threeRenderer) {
    state.threeRenderer.dispose();
    state.setThreeRenderer(null);
  }
  state.setThreeScene(null);
  state.setThreeCamera(null);
}
