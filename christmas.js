import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; 
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- CONFIGURATION ---
const CONFIG = {
    colors: {
        bg: 0x000000, 
        champagneGold: 0xffd966, 
        deepGreen: 0x0b3f1b,     
        accentRed: 0x990000,     
    },
    particles: {
        count: 1500,     
        dustCount: 2500, 
        treeHeight: 24,  
        treeRadius: 8    
    },
    camera: {
        z: 50 
    }
};

const STATE = {
    mode: 'TREE', 
    focusIndex: -1, 
    focusTarget: null,
    hand: { detected: false, x: 0, y: 0 },
    rotation: { x: 0, y: 0 } 
};

let scene, camera, renderer, composer;
let mainGroup; 
let clock = new THREE.Clock();
let particleSystem = []; 
let photoMeshGroup = new THREE.Group();
let handLandmarker, video, webcamCanvas, webcamCtx;
let caneTexture; 

async function init() {
    initThree();
    setupEnvironment(); 
    setupLights();
    createTextures();
    createParticles(); 
    createDust();     
    await createDefaultPhotos();
    setupPostProcessing();
    setupEvents();
    await initMediaPipe();
    
    const loader = document.getElementById('loader');
    loader.style.opacity = 0;
    setTimeout(() => loader.remove(), 800);

    animate();
}

function initThree() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.01); 

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z); 

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping; 
    renderer.toneMappingExposure = 2.2; 
    container.appendChild(renderer.domElement);

    mainGroup = new THREE.Group();
    scene.add(mainGroup);
}

function setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);

    const spotGold = new THREE.SpotLight(0xffcc66, 1200);
    spotGold.position.set(30, 40, 40);
    spotGold.angle = 0.5;
    spotGold.penumbra = 0.5;
    scene.add(spotGold);

    const spotBlue = new THREE.SpotLight(0x6688ff, 600);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);
    
    const fill = new THREE.DirectionalLight(0xffeebb, 0.8);
    fill.position.set(0, 0, 50);
    scene.add(fill);
}

function setupPostProcessing() {
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.7; 
    bloomPass.strength = 0.45; 
    bloomPass.radius = 0.4;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
}

function createTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#880000'; 
    ctx.beginPath();
    for(let i=-128; i<256; i+=32) {
        ctx.moveTo(i, 0); ctx.lineTo(i+32, 128); ctx.lineTo(i+16, 128); ctx.lineTo(i-16, 0);
    }
    ctx.fill();
    caneTexture = new THREE.CanvasTexture(canvas);
    caneTexture.wrapS = THREE.RepeatWrapping;
    caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3, 3);
}

class Particle {
    constructor(mesh, type, isDust = false) {
        this.mesh = mesh;
        this.type = type;
        this.isDust = isDust;
        
        this.posTree = new THREE.Vector3();
        this.posScatter = new THREE.Vector3();
        this.baseScale = mesh.scale.x; 

        // Individual Spin Speed
        // Photos spin slower to be readable
        const speedMult = (type === 'PHOTO') ? 0.3 : 2.0;

        this.spinSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult
        );

        this.calculatePositions();
    }

    calculatePositions() {
        // TREE: Tight Spiral
        const h = CONFIG.particles.treeHeight;
        const halfH = h / 2;
        let t = Math.random(); 
        t = Math.pow(t, 0.8); 
        const y = (t * h) - halfH;
        let rMax = CONFIG.particles.treeRadius * (1.0 - t); 
        if (rMax < 0.5) rMax = 0.5;
        const angle = t * 50 * Math.PI + Math.random() * Math.PI; 
        const r = rMax * (0.8 + Math.random() * 0.4); 
        this.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

        // SCATTER: 3D Sphere
        let rScatter = this.isDust ? (12 + Math.random()*20) : (8 + Math.random()*12);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        this.posScatter.set(
            rScatter * Math.sin(phi) * Math.cos(theta),
            rScatter * Math.sin(phi) * Math.sin(theta),
            rScatter * Math.cos(phi)
        );
    }

    update(dt, mode, focusTargetMesh) {
        let target = this.posTree;
        
        if (mode === 'SCATTER') target = this.posScatter;
        else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) {
                const desiredWorldPos = new THREE.Vector3(0, 2, 35);
                const invMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
                target = desiredWorldPos.applyMatrix4(invMatrix);
            } else {
                target = this.posScatter;
            }
        }

        // Movement Easing
        const lerpSpeed = (mode === 'FOCUS' && this.mesh === focusTargetMesh) ? 5.0 : 2.0; 
        this.mesh.position.lerp(target, lerpSpeed * dt);

        // Rotation Logic - CRITICAL: Ensure spin happens in Scatter
        if (mode === 'SCATTER') {
            this.mesh.rotation.x += this.spinSpeed.x * dt;
            this.mesh.rotation.y += this.spinSpeed.y * dt;
            this.mesh.rotation.z += this.spinSpeed.z * dt; // Added Z for more natural tumble
        } else if (mode === 'TREE') {
            // Reset rotations slowly
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt);
            this.mesh.rotation.y += 0.5 * dt; 
        }
        
        if (mode === 'FOCUS' && this.mesh === focusTargetMesh) {
            this.mesh.lookAt(camera.position); 
        }

        // Scale Logic
        let s = this.baseScale;
        if (this.isDust) {
            s = this.baseScale * (0.8 + 0.4 * Math.sin(clock.elapsedTime * 4 + this.mesh.id));
            if (mode === 'TREE') s = 0; 
        } else if (mode === 'SCATTER' && this.type === 'PHOTO') {
            // Large preview size in scatter
            s = this.baseScale * 2.5; 
        } else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) s = 4.5; 
            else s = this.baseScale * 0.8; 
        }
        
        this.mesh.scale.lerp(new THREE.Vector3(s,s,s), 4*dt);
    }
}

// --- CREATION ---
function createParticles() {
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32); 
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55); 
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)
    ]);
    const candyGeo = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.champagneGold,
        metalness: 1.0, roughness: 0.1,
        envMapIntensity: 2.0, 
        emissive: 0x443300,   
        emissiveIntensity: 0.3
    });

    const greenMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.deepGreen,
        metalness: 0.2, roughness: 0.8,
        emissive: 0x002200,
        emissiveIntensity: 0.2 
    });

    const redMat = new THREE.MeshPhysicalMaterial({
        color: CONFIG.colors.accentRed,
        metalness: 0.3, roughness: 0.2, clearcoat: 1.0,
        emissive: 0x330000
    });
    
    const candyMat = new THREE.MeshStandardMaterial({ map: caneTexture, roughness: 0.4 });

    for (let i = 0; i < CONFIG.particles.count; i++) {
        const rand = Math.random();
        let mesh, type;
        
        if (rand < 0.40) {
            mesh = new THREE.Mesh(boxGeo, greenMat);
            type = 'BOX';
        } else if (rand < 0.70) {
            mesh = new THREE.Mesh(boxGeo, goldMat);
            type = 'GOLD_BOX';
        } else if (rand < 0.92) {
            mesh = new THREE.Mesh(sphereGeo, goldMat);
            type = 'GOLD_SPHERE';
        } else if (rand < 0.97) {
            mesh = new THREE.Mesh(sphereGeo, redMat);
            type = 'RED';
        } else {
            mesh = new THREE.Mesh(candyGeo, candyMat);
            type = 'CANE';
        }

        const s = 0.4 + Math.random() * 0.5;
        mesh.scale.set(s,s,s);
        mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
        
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, type, false));
    }

    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshStandardMaterial({
        color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1.0,
        metalness: 1.0, roughness: 0
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, CONFIG.particles.treeHeight/2 + 1.2, 0);
    mainGroup.add(star);
    
    mainGroup.add(photoMeshGroup);
}

function createDust() {
    const geo = new THREE.TetrahedronGeometry(0.08, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.8 });
    
    for(let i=0; i<CONFIG.particles.dustCount; i++) {
         const mesh = new THREE.Mesh(geo, mat);
         mesh.scale.setScalar(0.5 + Math.random());
         mainGroup.add(mesh);
         particleSystem.push(new Particle(mesh, 'DUST', true));
    }
}

// Store manifest for lazy loading
let allPhotoPaths = [];
let loadedPhotoCount = 0;
const INITIAL_LOAD_COUNT = 10;  // Load 10 photos initially
const LAZY_LOAD_DELAY = 100;    // Delay between loading each photo (ms)

async function createDefaultPhotos() {
    const loaded = [];

    // First try a manifest file in the folder: Memories/manifest.json
    try {
        const res = await fetch('Memories/manifest.json');
        if (res.ok) {
            allPhotoPaths = await res.json();
            // Load only first batch initially
            for (let i = 0; i < Math.min(INITIAL_LOAD_COUNT, allPhotoPaths.length); i++) {
                try {
                    const p = allPhotoPaths[i];
                    const tex = await new Promise((resolve, reject) => {
                        new THREE.TextureLoader().load(p, resolve, undefined, reject);
                    });
                    if (tex) { tex.colorSpace = THREE.SRGBColorSpace; loaded.push(tex); }
                } catch (e) { console.warn('无法加载清单中的图片', allPhotoPaths[i], e); }
            }
            loadedPhotoCount = Math.min(INITIAL_LOAD_COUNT, allPhotoPaths.length);
            
            // Start lazy loading remaining photos after page renders
            if (allPhotoPaths.length > INITIAL_LOAD_COUNT) {
                setTimeout(loadRemainingPhotos, 500);
            }
        }
    } catch (e) {
        // manifest not found or fetch failed, proceed to heuristic
        allPhotoPaths = [];
    }

    // Heuristic: try common name patterns (image1..image30) and common extensions
    if (loaded.length === 0) {
        const prefixes = ['image','img','photo','Memories',''];
        const exts = ['jpg','jpeg','png','webp'];
        outer: for (let i = 1; i <= 30; i++) {
            for (const pre of prefixes) {
                for (const ext of exts) {
                    const name = pre ? `${pre}${i}.${ext}` : `${i}.${ext}`;
                    const path = `Memories/${name}`;
                    try {
                        const tex = await new Promise((resolve, reject) => {
                            new THREE.TextureLoader().load(path, resolve, undefined, reject);
                        });
                        if (tex) { tex.colorSpace = THREE.SRGBColorSpace; loaded.push(tex); }
                        if (loaded.length >= 8) break outer;
                    } catch (err) {
                        // ignore missing files
                    }
                }
            }
        }
    }

    if (loaded.length > 0) {
        loaded.forEach(t => addPhotoToScene(t));
        return;
    }

    // Fallback: original placeholder canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050505'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#eebb66'; ctx.lineWidth = 15; ctx.strokeRect(20,20,472,472);
    ctx.font = '500 60px Times New Roman'; ctx.fillStyle = '#eebb66';
    ctx.textAlign = 'center'; 
    ctx.fillText("HILARY", 256, 230);
    ctx.fillText("MAX", 256, 300);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    addPhotoToScene(tex);
}

async function loadRemainingPhotos() {
    console.log(`开始后台加载剩余照片... (已加载 ${loadedPhotoCount}/${allPhotoPaths.length})`);
    
    for (let i = loadedPhotoCount; i < allPhotoPaths.length; i++) {
        try {
            const p = allPhotoPaths[i];
            const tex = await new Promise((resolve, reject) => {
                new THREE.TextureLoader().load(p, resolve, undefined, reject);
            });
            if (tex) { 
                tex.colorSpace = THREE.SRGBColorSpace; 
                addPhotoToScene(tex);
                loadedPhotoCount++;
                console.log(`加载进度: ${loadedPhotoCount}/${allPhotoPaths.length}`);
            }
        } catch (e) { 
            console.warn('无法加载图片', allPhotoPaths[i], e); 
            loadedPhotoCount++;
        }
        
        // Add delay between loading to avoid blocking
        if (i < allPhotoPaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, LAZY_LOAD_DELAY));
        }
    }
    
    console.log(`所有照片加载完成! 总共 ${allPhotoPaths.length} 张`);
}

function addPhotoToScene(texture) {
    // Preserve original image aspect ratio when creating the photo plane and frame
    // Determine aspect from the underlying image (texture.image may be an HTMLImageElement or canvas)
    let aspect = 1;
    if (texture && texture.image) {
        const img = texture.image;
        if (img.width && img.height) aspect = img.width / img.height;
    }

    const baseSize = 1.2; // desired reference height
    const photoWidth = baseSize * aspect;
    const photoHeight = baseSize;

    // Create frame slightly larger than photo to give a border
    const framePadding = 0.12;
    const frameGeo = new THREE.BoxGeometry(photoWidth + framePadding, photoHeight + framePadding, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.champagneGold, metalness: 1.0, roughness: 0.1 });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);
    const photoMat = new THREE.MeshBasicMaterial({ map: texture });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.035; // sit slightly in front of frame

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);

    const s = 0.8; // uniform scale for group
    group.scale.set(s, s, s);

    photoMeshGroup.add(group);
    particleSystem.push(new Particle(group, 'PHOTO', false));
}
        
function handleImageUpload(e) {
    const files = e.target.files;
    if(!files.length) return;
    Array.from(files).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            new THREE.TextureLoader().load(ev.target.result, (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                addPhotoToScene(t);
            });
        }
        reader.readAsDataURL(f);
    });
}

// --- MEDIAPIPE ---
async function initMediaPipe() {
    try {
        video = document.getElementById('webcam');
        webcamCanvas = document.getElementById('webcam-preview');
        webcamCtx = webcamCanvas.getContext('2d');
        webcamCanvas.width = 160; webcamCanvas.height = 120;

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        
        if (navigator.mediaDevices?.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
                video.srcObject = stream;
                await new Promise(resolve => {
                    video.onloadedmetadata = () => {
                        video.play();
                        resolve();
                    };
                });
                predictWebcam();
            } catch (err) {
                console.warn('摄像头访问被拒绝或不可用，手势控制已禁用', err);
            }
        }
    } catch (err) {
        console.error('MediaPipe 初始化失败', err);
    }
}

let lastVideoTime = -1;
async function predictWebcam() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        if (handLandmarker) {
            const result = handLandmarker.detectForVideo(video, performance.now());
            processGestures(result);
        }
    }
    requestAnimationFrame(predictWebcam);
}

function processGestures(result) {
    if (result.landmarks && result.landmarks.length > 0) {
        STATE.hand.detected = true;
        const lm = result.landmarks[0];
        STATE.hand.x = (lm[9].x - 0.5) * 2; 
        STATE.hand.y = (lm[9].y - 0.5) * 2;

        const thumb = lm[4]; const index = lm[8]; const wrist = lm[0];
        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        const tips = [lm[8], lm[12], lm[16], lm[20]];
        let avgDist = 0;
        tips.forEach(t => avgDist += Math.hypot(t.x - wrist.x, t.y - wrist.y));
        avgDist /= 4;

        if (pinchDist < 0.05) {
            if (STATE.mode !== 'FOCUS') {
                STATE.mode = 'FOCUS';
                const photos = particleSystem.filter(p => p.type === 'PHOTO');
                if (photos.length) STATE.focusTarget = photos[Math.floor(Math.random()*photos.length)].mesh;
            }
        } else if (avgDist < 0.25) {
            STATE.mode = 'TREE';
            STATE.focusTarget = null;
        } else if (avgDist > 0.4) {
            STATE.mode = 'SCATTER';
            STATE.focusTarget = null;
        }
    } else {
        STATE.hand.detected = false;
    }
}

function setupEvents() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
    document.getElementById('file-input').addEventListener('change', handleImageUpload);
    
    // Background music auto-play with user interaction fallback
    const audioElement = document.getElementById('background-music');
    if (audioElement) {
        // Try to play automatically (may be blocked by browser)
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Auto-play failed, wait for user interaction
                const playOnInteraction = () => {
                    audioElement.play().catch(() => {});
                    document.removeEventListener('click', playOnInteraction);
                    document.removeEventListener('keydown', playOnInteraction);
                };
                document.addEventListener('click', playOnInteraction, { once: true });
                document.addEventListener('keydown', playOnInteraction, { once: true });
            });
        }
    }
    
    // Toggle UI logic - ONLY hide controls, keep title
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'h') {
            const controls = document.querySelector('.upload-wrapper');
            if (controls) controls.classList.toggle('ui-hidden');
        }
    });
}
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // Rotation Logic
    if (STATE.mode === 'SCATTER' && STATE.hand.detected) {
        const targetRotY = STATE.hand.x * Math.PI * 0.9; 
        const targetRotX = STATE.hand.y * Math.PI * 0.25;
        STATE.rotation.y += (targetRotY - STATE.rotation.y) * 3.0 * dt;
        STATE.rotation.x += (targetRotX - STATE.rotation.x) * 3.0 * dt;
    } else {
        if(STATE.mode === 'TREE') {
            STATE.rotation.y += 0.3 * dt;
            STATE.rotation.x += (0 - STATE.rotation.x) * 2.0 * dt;
        } else {
             STATE.rotation.y += 0.1 * dt; 
        }
    }

    mainGroup.rotation.y = STATE.rotation.y;
    mainGroup.rotation.x = STATE.rotation.x;

    particleSystem.forEach(p => p.update(dt, STATE.mode, STATE.focusTarget));
    composer.render();
}

init();
