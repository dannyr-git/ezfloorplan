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

  const threeCamera = new THREE.PerspectiveCamera(45, width / height, 1, 100000);
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
          
          const elHeight = elem.element.heightInches || (elem.kind === "door" ? 80 : 48);
          const elBaseOffset = elem.element.baseOffsetInches != null ? elem.element.baseOffsetInches : (elem.kind === "door" ? 0 : 36);
          
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
      // Doors and windows are rendered the same way - just different visuals
      const height = l.heightInches || (kind === "door" ? 80 : 48);
      const baseOffset = l.baseOffsetInches != null ? l.baseOffsetInches : (kind === "door" ? 0 : 36);
      const yCenter = baseOffset + height / 2;
      
      // Position door/window at the interior line (no offset - it's in the wall opening)
      const elemCenterX = midX;
      const elemCenterY = midY;
      
      if (kind === "door") {
        // Door panel - thin, inside the wall
        const geom = new THREE.BoxGeometry(length, height, wallThickness * 0.2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(elemCenterX, yCenter, elemCenterY);
        mesh.rotation.y = angle;
        threeScene.add(mesh);
        
        // Door frame
        if (doorTrim > 0) {
          const frameGeom = new THREE.BoxGeometry(length + doorTrim * 2, height + doorTrim, wallThickness * 0.3);
          const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
          const frameMesh = new THREE.Mesh(frameGeom, frameMat);
          frameMesh.position.set(elemCenterX, yCenter + doorTrim / 2, elemCenterY);
          frameMesh.rotation.y = angle;
          threeScene.add(frameMesh);
        }
      } else {
        // Window - glass pane
        const glassGeom = new THREE.BoxGeometry(length - 2, height - 2, wallThickness * 0.1);
        const glassMat = new THREE.MeshStandardMaterial({ 
          color: 0x87CEEB, 
          transparent: true, 
          opacity: 0.5 
        });
        const glassMesh = new THREE.Mesh(glassGeom, glassMat);
        glassMesh.position.set(elemCenterX, yCenter, elemCenterY);
        glassMesh.rotation.y = angle;
        threeScene.add(glassMesh);
        
        // Window frame
        if (windowTrim > 0) {
          const frameGeom = new THREE.BoxGeometry(length + windowTrim * 2, height + windowTrim * 2, wallThickness * 0.25);
          const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
          const frameMesh = new THREE.Mesh(frameGeom, frameMat);
          frameMesh.position.set(elemCenterX, yCenter, elemCenterY);
          frameMesh.rotation.y = angle;
          threeScene.add(frameMesh);
        }
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

  // Mouse controls for 3D scene
  let isMouseDownThree = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  threeContainer.addEventListener("mousedown", (e) => {
    isMouseDownThree = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  threeContainer.addEventListener("mousemove", (e) => {
    if (!isMouseDownThree || !threeCamera.orbitCenter) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Rotate camera around the center point
    const rotationSpeed = 0.01;
    threeCamera.orbitPhi -= deltaX * rotationSpeed;
    threeCamera.orbitTheta += deltaY * rotationSpeed;

    // Clamp theta to avoid flipping
    const maxTheta = Math.PI / 2 - 0.1;
    threeCamera.orbitTheta = Math.max(-maxTheta, Math.min(maxTheta, threeCamera.orbitTheta));

    // Update camera position
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

  // Wheel zoom
  threeContainer.addEventListener("wheel", (e) => {
    if (!threeCamera.orbitCenter) return;
    e.preventDefault();
    const zoomSpeed = 0.1;
    const zoomFactor = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
    threeCamera.orbitRadius *= zoomFactor;
    threeCamera.orbitRadius = Math.max(50, Math.min(5000, threeCamera.orbitRadius));

    // Update camera position with new radius
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
}

export function close3DScene() {
  const threeContainer = dom.getThreeContainer();
  threeContainer.style.display = "none";
  if (state.threeRenderer) {
    state.threeRenderer.dispose();
    state.setThreeRenderer(null);
  }
  state.setThreeScene(null);
  state.setThreeCamera(null);
}
