/**
 * Interactive 3D E-School - Main JavaScript Application
 * Hacktoberfest Rwanda x Build54 Africa Hackathon
 * 
 * Upgraded Features:
 *  1. Biology: Stylized 3D Human Anatomy Model with Transparent Torso & Distinct
 *     Internal Organs: Liver, Heart (pulsing), Lungs (breathing), and Stomach.
 *     Full Raycasting interactivity with organ highlights and detailed info cards.
 *  2. Chemistry: Manual Substance Selection (Substance A + Substance B) with
 *     "Mix / React" button triggering dynamic 3D reactions (Acid-Base shifts,
 *     high-speed effervescence, precipitate, and 3D Potassium explosions!).
 *  3. Physics: 3D Projectile Motion Cannon & Animated Parabolic Trajectory (THREE.Line).
 *  4. Multimodal AI Tutor Integration (Gemini / Gemma 4):
 *     - "Snap 3D & Ask AI" using renderer.domElement.toDataURL('image/png')
 *     - Dynamic tutor switching (Dr. Helix, Prof. Newton, Dr. Curie)
 *     - Real-time simulation telemetry & voice synthesis (TTS)
 */

// Global Application State
const AppState = {
    currentSubject: 'biology', // 'biology' | 'physics' | 'chemistry'
    activeSnapshot: null,
    autoRotate: true,
    ttsEnabled: true,
    
    // Biology / Anatomy state
    biology: {
        focusOrgan: 'all',
        exploded: false,
        ghostTorso: true
    },
    
    // Physics state
    physics: {
        angle: 45,             // degrees
        speed: 25,             // m/s
        gravity: 9.8,          // m/s^2
        isSimulating: false,
        simTime: 0,
        trajectoryPoints: [],
        calculatedRange: 63.7,
        calculatedMaxH: 15.9,
        calculatedFlightTime: 3.60
    },
    
    // Chemistry state (Manual Substance Selection)
    chemistry: {
        substanceA: 'hcl',
        substanceB: 'naoh',
        reactionName: 'Acid-Base Neutralization',
        equation: '\\text{HCl} + \\text{NaOH} \\longrightarrow \\text{NaCl} + \\text{H}_2\\text{O} + \\Delta H',
        isStirring: false,
        ph: 7.0,
        temp: 22.0,
        targetColor: 0xeab308, // starts acidic yellow
        bubbleSpeedFactor: 1.0,
        bubbleCountActive: 40,
        hasExplosion: false,
        explosionTime: 0
    }
};

// Web Audio synthesizer for UI audio feedback
const SoundFX = {
    ctx: null,
    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone(freq, type, duration, gainVal) {
        try {
            this.init();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(gainVal || 0.05, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (duration || 0.1));
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + (duration || 0.1));
        } catch (e) {}
    },
    snap() { this.playTone(880, 'sine', 0.08); },
    launch() { this.playTone(280, 'triangle', 0.28, 0.08); },
    bubble() { this.playTone(550 + Math.random() * 250, 'sine', 0.05, 0.03); },
    explosion() {
        this.playTone(110, 'sawtooth', 0.45, 0.18);
        setTimeout(() => this.playTone(220, 'triangle', 0.3, 0.12), 60);
    },
    click() { this.playTone(480, 'sine', 0.04, 0.04); }
};

// ===================================================================
// Three.js 3D Viewport Engine
// ===================================================================
class ThreeEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.canvas = document.getElementById('three-canvas');
        
        // Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x080b15);
        this.scene.fog = new THREE.FogExp2(0x080b15, 0.016);
        
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || (window.innerHeight - 64);
        
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.set(0, 6, 20);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true // CRITICAL: enables canvas.toDataURL() snapshot capture!
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // OrbitControls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2 + 0.1;
            this.controls.minDistance = 3;
            this.controls.maxDistance = 90;
        } else {
            this.controls = null;
        }
        
        // Lights
        this.setupLights();
        
        // Raycaster
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Subject Groups
        this.biologyGroup = new THREE.Group();
        this.physicsGroup = new THREE.Group();
        this.chemistryGroup = new THREE.Group();
        
        this.scene.add(this.biologyGroup);
        this.scene.add(this.physicsGroup);
        this.scene.add(this.chemistryGroup);
        
        // Build 3 Scenes
        this.buildHumanAnatomyScene();
        this.buildPhysicsScene();
        this.buildChemistryScene();
        
        // Initial Subject
        this.switchSubject('biology');
        
        // Events
        window.addEventListener('resize', () => this.onWindowResize());
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        
        // Animation Clock
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }
    
    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(15, 25, 15);
        this.scene.add(dirLight);
        
        const cyanPoint = new THREE.PointLight(0x38bdf8, 1.2, 40);
        cyanPoint.position.set(-12, 10, 8);
        this.scene.add(cyanPoint);
        
        const purplePoint = new THREE.PointLight(0xa855f7, 1.0, 40);
        purplePoint.position.set(12, -6, -8);
        this.scene.add(purplePoint);
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    switchSubject(subject) {
        AppState.currentSubject = subject;
        
        this.biologyGroup.visible = (subject === 'biology');
        this.physicsGroup.visible = (subject === 'physics');
        this.chemistryGroup.visible = (subject === 'chemistry');
        
        if (subject === 'biology') {
            this.camera.position.set(0, 5, 18);
            if (this.controls) this.controls.target.set(0, 4.5, 0);
        } else if (subject === 'physics') {
            this.camera.position.set(-10, 16, 44);
            if (this.controls) this.controls.target.set(20, 3, 0);
        } else if (subject === 'chemistry') {
            this.camera.position.set(0, 5, 15);
            if (this.controls) this.controls.target.set(0, 3, 0);
        }
        
        if (this.controls) this.controls.update();
        document.getElementById('raycast-tooltip').classList.add('hidden');
    }
    
    resetCamera() {
        this.switchSubject(AppState.currentSubject);
        SoundFX.click();
    }
    
    // ===================================================================
    // 1. BIOLOGY UPGRADE: 3D Human Anatomy Model
    // Built purely with Three.js basic geometries (Spheres, Cylinders, Toruses)
    // Featuring: Transparent Torso & Distinct Internal Organs (Liver, Heart, Lungs, Stomach)
    // ===================================================================
    buildHumanAnatomyScene() {
        this.anatomyOrgans = []; // List of clickable organs
        
        // -------------------------------------------------------------
        // A. Transparent Body Silhouette (Torso, Head, Neck, Shoulders)
        // -------------------------------------------------------------
        this.bodyFrameGroup = new THREE.Group();
        
        const glassBodyMat = new THREE.MeshStandardMaterial({
            color: 0x93c5fd,
            transparent: true,
            opacity: 0.20,
            roughness: 0.15,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        // 1. Torso: Upper chest to hips (Tapered cylinder)
        const torsoGeo = new THREE.CylinderGeometry(2.7, 2.1, 7.8, 24, 1, false);
        this.torsoMesh = new THREE.Mesh(torsoGeo, glassBodyMat);
        this.torsoMesh.position.set(0, 4.4, 0);
        this.bodyFrameGroup.add(this.torsoMesh);
        
        // 2. Neck & Head
        const neckGeo = new THREE.CylinderGeometry(0.85, 0.95, 1.2, 18);
        const neckMesh = new THREE.Mesh(neckGeo, glassBodyMat);
        neckMesh.position.set(0, 8.8, 0);
        this.bodyFrameGroup.add(neckMesh);
        
        const headGeo = new THREE.SphereGeometry(1.5, 24, 24);
        const headMesh = new THREE.Mesh(headGeo, glassBodyMat);
        headMesh.position.set(0, 10.1, 0);
        headMesh.scale.set(1.0, 1.15, 1.05); // slightly oval human cranial shape
        this.bodyFrameGroup.add(headMesh);
        
        // 3. Shoulders & Upper Arm Outlines
        const shoulderGeo = new THREE.CylinderGeometry(0.5, 0.5, 6.8, 16);
        const shoulderMesh = new THREE.Mesh(shoulderGeo, glassBodyMat);
        shoulderMesh.rotation.z = Math.PI / 2;
        shoulderMesh.position.set(0, 8.0, 0);
        this.bodyFrameGroup.add(shoulderMesh);
        
        // Left & Right Upper Arm Silhouettes
        const armGeo = new THREE.CylinderGeometry(0.55, 0.45, 5.0, 16);
        const leftArm = new THREE.Mesh(armGeo, glassBodyMat);
        leftArm.position.set(3.4, 5.5, 0);
        leftArm.rotation.z = -0.15;
        const rightArm = new THREE.Mesh(armGeo, glassBodyMat);
        rightArm.position.set(-3.4, 5.5, 0);
        rightArm.rotation.z = 0.15;
        this.bodyFrameGroup.add(leftArm, rightArm);
        
        // 4. Pelvis / Hips Base
        const pelvisGeo = new THREE.CylinderGeometry(2.1, 1.7, 1.8, 20);
        const pelvisMesh = new THREE.Mesh(pelvisGeo, glassBodyMat);
        pelvisMesh.position.set(0, 0.2, 0);
        this.bodyFrameGroup.add(pelvisMesh);
        
        // 5. Internal Vertebral Spine (Column of small segmented discs)
        this.spineGroup = new THREE.Group();
        for (let i = 0; i < 14; i++) {
            const vGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
            const vMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
            const vMesh = new THREE.Mesh(vGeo, vMat);
            vMesh.position.set(0, 1.2 + i * 0.5, -0.6); // posterior positioning
            this.spineGroup.add(vMesh);
        }
        this.bodyFrameGroup.add(this.spineGroup);
        
        // 6. Ghost Ribcage (Subtle thoracic rings)
        for (let r = 0; r < 4; r++) {
            const ribGeo = new THREE.TorusGeometry(2.35 - r * 0.1, 0.05, 8, 24);
            const ribMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35 });
            const ribMesh = new THREE.Mesh(ribGeo, ribMat);
            ribMesh.rotation.x = Math.PI / 2;
            ribMesh.position.set(0, 4.6 + r * 0.8, 0);
            this.bodyFrameGroup.add(ribMesh);
        }
        
        this.biologyGroup.add(this.bodyFrameGroup);
        
        // -------------------------------------------------------------
        // B. Distinct Internal Organs (Liver, Heart, Lungs, Stomach)
        // -------------------------------------------------------------
        
        // 1. HEART (Cor) - Situated in mediastinum slightly left of sternum
        this.heartGroup = new THREE.Group();
        this.heartGroup.position.set(0.5, 5.4, 0.5);
        
        // Muscular conical heart body (crimson red)
        const heartMat = new THREE.MeshStandardMaterial({
            color: 0xdc2626,
            roughness: 0.3,
            metalness: 0.15,
            emissive: 0x7f1d1d,
            emissiveIntensity: 0.35
        });
        
        const ventricleGeo = new THREE.ConeGeometry(0.75, 1.5, 18);
        const ventricleMesh = new THREE.Mesh(ventricleGeo, heartMat);
        ventricleMesh.rotation.z = Math.PI + 0.25; // inverted point facing left hip
        this.heartGroup.add(ventricleMesh);
        
        // Atrium lobes on top
        const atriumGeo = new THREE.SphereGeometry(0.48, 16, 16);
        const rightAtrium = new THREE.Mesh(atriumGeo, heartMat);
        rightAtrium.position.set(-0.35, 0.6, 0);
        const leftAtrium = new THREE.Mesh(atriumGeo, heartMat);
        leftAtrium.position.set(0.35, 0.6, 0);
        this.heartGroup.add(rightAtrium, leftAtrium);
        
        // Aorta vessel arch emerging from top (red/purple tube)
        const aortaCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.8, 0),
            new THREE.Vector3(0, 1.3, 0),
            new THREE.Vector3(-0.3, 1.5, -0.2),
            new THREE.Vector3(-0.5, 1.2, -0.4)
        ]);
        const aortaGeo = new THREE.TubeGeometry(aortaCurve, 16, 0.16, 10, false);
        const aortaMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.3 });
        const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
        this.heartGroup.add(aortaMesh);
        
        this.heartGroup.userData = {
            id: 'heart',
            name: 'Heart (Cor)',
            organIcon: '🫀',
            desc: 'Four-chambered central muscular pump circulating oxygenated blood throughout systemic and pulmonary pathways (~70 bpm, pumping 5L blood/minute).',
            originalPos: this.heartGroup.position.clone(),
            dissectOffset: new THREE.Vector3(0.5, 0, 2.5)
        };
        this.biologyGroup.add(this.heartGroup);
        this.anatomyOrgans.push(ventricleMesh, rightAtrium, leftAtrium, aortaMesh);
        
        // 2. LUNGS (Pulmones) - Left and Right spongy pulmonary organs
        this.lungsGroup = new THREE.Group();
        this.lungsGroup.position.set(0, 5.3, 0.1);
        
        const lungMat = new THREE.MeshStandardMaterial({
            color: 0xf472b6,
            roughness: 0.45,
            metalness: 0.05,
            emissive: 0xbe185d,
            emissiveIntensity: 0.2
        });
        
        // Right Lung (3 lobes: larger)
        const rightLungGeo = new THREE.CylinderGeometry(0.7, 0.85, 2.6, 16);
        this.rightLungMesh = new THREE.Mesh(rightLungGeo, lungMat);
        this.rightLungMesh.position.set(-1.45, 0, 0);
        this.rightLungMesh.scale.set(1.0, 1.0, 0.9);
        
        const rCapGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const rTopCap = new THREE.Mesh(rCapGeo, lungMat);
        rTopCap.position.set(-1.45, 1.3, 0);
        
        // Left Lung (2 lobes with cardiac notch for heart: slightly smaller)
        const leftLungGeo = new THREE.CylinderGeometry(0.65, 0.75, 2.5, 16);
        this.leftLungMesh = new THREE.Mesh(leftLungGeo, lungMat);
        this.leftLungMesh.position.set(1.45, 0, 0);
        this.leftLungMesh.scale.set(0.95, 1.0, 0.85);
        
        const lCapGeo = new THREE.SphereGeometry(0.65, 16, 16);
        const lTopCap = new THREE.Mesh(lCapGeo, lungMat);
        lTopCap.position.set(1.45, 1.25, 0);
        
        // Trachea & Primary Bronchi Tree (Blue/gray cartilage rings tube)
        const tracheaGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 12);
        const tracheaMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.2 });
        const tracheaMesh = new THREE.Mesh(tracheaGeo, tracheaMat);
        tracheaMesh.position.set(0, 1.8, -0.1);
        
        this.lungsGroup.add(this.rightLungMesh, rTopCap, this.leftLungMesh, lTopCap, tracheaMesh);
        this.lungsGroup.userData = {
            id: 'lungs',
            name: 'Lungs (Pulmones)',
            organIcon: '🫁',
            desc: 'Bilateral respiratory organs featuring over 300 million micro-alveoli. Facilitates vital gas exchange (absorbing O₂ into capillaries and expelling CO₂).',
            originalPos: this.lungsGroup.position.clone(),
            dissectOffset: new THREE.Vector3(0, 0, 2.8)
        };
        this.biologyGroup.add(this.lungsGroup);
        this.anatomyOrgans.push(this.rightLungMesh, rTopCap, this.leftLungMesh, lTopCap, tracheaMesh);
        
        // 3. LIVER (Hepar) - Large reddish-brown wedge in upper right abdominal quadrant
        this.liverGroup = new THREE.Group();
        this.liverGroup.position.set(-0.85, 2.8, 0.4);
        
        const liverMat = new THREE.MeshStandardMaterial({
            color: 0xb45309, // reddish-brown / amber
            roughness: 0.35,
            metalness: 0.1,
            emissive: 0x78350f,
            emissiveIntensity: 0.3
        });
        
        // Major Right Lobe (wedge cylinder + hemisphere)
        const liverRightGeo = new THREE.CylinderGeometry(1.2, 1.0, 1.4, 16);
        const liverRightMesh = new THREE.Mesh(liverRightGeo, liverMat);
        liverRightMesh.rotation.z = 0.35;
        
        // Minor Left Lobe
        const liverLeftGeo = new THREE.SphereGeometry(0.85, 16, 16);
        const liverLeftMesh = new THREE.Mesh(liverLeftGeo, liverMat);
        liverLeftMesh.position.set(1.0, -0.2, 0);
        liverLeftMesh.scale.set(1.2, 0.7, 0.9);
        
        // Gallbladder nestled on inferior surface (emerald green sac)
        const gallGeo = new THREE.SphereGeometry(0.28, 12, 12);
        const gallMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.4 });
        const gallMesh = new THREE.Mesh(gallGeo, gallMat);
        gallMesh.position.set(0.1, -0.7, 0.5);
        
        this.liverGroup.add(liverRightMesh, liverLeftMesh, gallMesh);
        this.liverGroup.userData = {
            id: 'liver',
            name: 'Liver & Gallbladder (Hepar)',
            organIcon: '🟤',
            desc: 'The body\'s primary chemical laboratory. Synthesizes bile for lipid emulsification, clears toxins/drugs, stores glycogen, and manufactures blood albumin.',
            originalPos: this.liverGroup.position.clone(),
            dissectOffset: new THREE.Vector3(-1.2, 0, 2.4)
        };
        this.biologyGroup.add(this.liverGroup);
        this.anatomyOrgans.push(liverRightMesh, liverLeftMesh, gallMesh);
        
        // 4. STOMACH (Gaster) - J-shaped organ in upper left abdominal quadrant
        this.stomachGroup = new THREE.Group();
        this.stomachGroup.position.set(0.85, 2.6, 0.35);
        
        const stomachCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.2, 0.8, 0),
            new THREE.Vector3(0.4, 0.4, 0.2),
            new THREE.Vector3(0.5, -0.4, 0.1),
            new THREE.Vector3(-0.3, -0.7, 0)
        ]);
        const stomachGeo = new THREE.TubeGeometry(stomachCurve, 20, 0.45, 14, false);
        const stomachMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            roughness: 0.35,
            emissive: 0xc2410c,
            emissiveIntensity: 0.25
        });
        const stomachMesh = new THREE.Mesh(stomachGeo, stomachMat);
        this.stomachGroup.add(stomachMesh);
        
        this.stomachGroup.userData = {
            id: 'stomach',
            name: 'Stomach (Gaster)',
            organIcon: '🥣',
            desc: 'Muscular J-shaped reservoir secreting gastric acid (HCl pH ~1.5) and protease enzymes to digest proteins into chyme before passing into duodenum.',
            originalPos: this.stomachGroup.position.clone(),
            dissectOffset: new THREE.Vector3(1.2, 0, 2.4)
        };
        this.biologyGroup.add(this.stomachGroup);
        this.anatomyOrgans.push(stomachMesh);
        
        // Studio Floor Pedestal Grid
        const anatGrid = new THREE.GridHelper(26, 26, 0x38bdf8, 0x1e293b);
        anatGrid.position.y = -0.7;
        this.biologyGroup.add(anatGrid);
    }
    
    toggleBiologyExplode() {
        AppState.biology.exploded = !AppState.biology.exploded;
        const isExp = AppState.biology.exploded;
        
        // Animate organs outward or back to natural anatomical position
        const organs = [this.heartGroup, this.lungsGroup, this.liverGroup, this.stomachGroup];
        organs.forEach(org => {
            const target = isExp 
                ? org.userData.originalPos.clone().add(org.userData.dissectOffset)
                : org.userData.originalPos.clone();
            this.tweenPosition(org, target, 500);
        });
        
        document.getElementById('explode-btn-text').innerText = isExp ? 'Assemble Organs' : 'Dissect Organs';
        SoundFX.snap();
    }
    
    toggleBiologySlice() {
        AppState.biology.ghostTorso = !AppState.biology.ghostTorso;
        const isGhost = AppState.biology.ghostTorso;
        
        this.torsoMesh.material.opacity = isGhost ? 0.20 : 0.04;
        this.torsoMesh.material.wireframe = !isGhost;
        document.getElementById('slice-btn-text').innerText = isGhost ? 'Ghost Torso' : 'Solid Torso';
        SoundFX.click();
    }
    
    focusOrgan(name) {
        AppState.biology.focusOrgan = name;
        SoundFX.click();
        
        if (name === 'heart') {
            const p = this.heartGroup.position;
            this.tweenCamera(new THREE.Vector3(p.x, p.y + 0.2, p.z + 5.5), p, 600);
            this.showRaycastTooltip({
                icon: '🫀',
                title: 'Heart (Cor)',
                desc: 'Four-chambered muscular cardiac pump. Generates systemic systolic arterial pressure.'
            });
        } else if (name === 'lungs') {
            const p = this.lungsGroup.position;
            this.tweenCamera(new THREE.Vector3(p.x, p.y + 0.2, p.z + 6.5), p, 600);
            this.showRaycastTooltip({
                icon: '🫁',
                title: 'Lungs (Pulmones)',
                desc: 'Bilateral respiratory organs with 300 million micro-alveoli providing gas exchange.'
            });
        } else if (name === 'liver') {
            const p = this.liverGroup.position;
            this.tweenCamera(new THREE.Vector3(p.x, p.y, p.z + 5.5), p, 600);
            this.showRaycastTooltip({
                icon: '🟤',
                title: 'Liver & Gallbladder (Hepar)',
                desc: 'Major metabolic visceral organ. Performs detoxification, bile secretion, and glycogen synthesis.'
            });
        } else if (name === 'stomach') {
            const p = this.stomachGroup.position;
            this.tweenCamera(new THREE.Vector3(p.x, p.y, p.z + 5.5), p, 600);
            this.showRaycastTooltip({
                icon: '🥣',
                title: 'Stomach (Gaster)',
                desc: 'Digestive organ churning food with gastric juices and hydrochloric acid (pH 1.5-2.0).'
            });
        } else {
            this.tweenCamera(new THREE.Vector3(0, 5, 18), new THREE.Vector3(0, 4.5, 0), 600);
            document.getElementById('raycast-tooltip').classList.add('hidden');
        }
    }
    
    // ===================================================================
    // 2. PHYSICS: 3D Projectile Motion Laboratory
    // Cannon, Parabolic Trajectory (THREE.Line) & Kinematics
    // ===================================================================
    buildPhysicsScene() {
        const physGrid = new THREE.GridHelper(100, 50, 0x38bdf8, 0x1e293b);
        physGrid.position.set(25, 0, 0);
        this.physicsGroup.add(physGrid);
        
        // Cannon Base & Barrel
        this.cannonBase = new THREE.Group();
        this.cannonBase.position.set(0, 0, 0);
        
        const stand = new THREE.Mesh(
            new THREE.CylinderGeometry(1.4, 1.8, 0.8, 20),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
        );
        stand.position.y = 0.4;
        this.cannonBase.add(stand);
        
        this.cannonBarrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.5, 3.6, 20),
            new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x0369a1,
                emissiveIntensity: 0.3
            })
        );
        this.cannonBarrel.geometry.translate(0, 1.8, 0);
        this.cannonBarrel.position.set(0, 0.8, 0);
        this.cannonBarrel.rotation.z = -THREE.MathUtils.degToRad(45);
        this.cannonBase.add(this.cannonBarrel);
        this.physicsGroup.add(this.cannonBase);
        
        // Projectile Sphere
        const projGeo = new THREE.SphereGeometry(0.5, 20, 20);
        const projMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            emissiveIntensity: 0.6,
            roughness: 0.2
        });
        this.projectileBall = new THREE.Mesh(projGeo, projMat);
        this.projectileBall.position.set(0, 1.0, 0);
        this.physicsGroup.add(this.projectileBall);
        
        // Animated Parabolic Trajectory line (THREE.Line)
        this.maxTrailPoints = 300;
        this.trailPositions = new Float32Array(this.maxTrailPoints * 3);
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        
        this.trailLine = new THREE.Line(
            this.trailGeometry,
            new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 })
        );
        this.physicsGroup.add(this.trailLine);
        
        // Theoretical preview curve
        this.theoreticalCurveGroup = new THREE.Group();
        this.physicsGroup.add(this.theoreticalCurveGroup);
        
        // Target Landing Ring
        const targetGeo = new THREE.RingGeometry(1.0, 1.6, 24);
        const targetMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        this.targetRing = new THREE.Mesh(targetGeo, targetMat);
        this.targetRing.rotation.x = -Math.PI / 2;
        this.targetRing.position.set(30, 0.05, 0);
        this.physicsGroup.add(this.targetRing);
        
        // Impact Shockwave
        const impactGeo = new THREE.RingGeometry(0.2, 0.6, 20);
        const impactMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        this.impactRing = new THREE.Mesh(impactGeo, impactMat);
        this.impactRing.rotation.x = -Math.PI / 2;
        this.impactRing.position.set(0, 0.06, 0);
        this.physicsGroup.add(this.impactRing);
        
        this.updatePhysicsParameters(45, 25, 9.8);
    }
    
    updatePhysicsParameters(angle, speed, gravity) {
        AppState.physics.angle = parseFloat(angle);
        AppState.physics.speed = parseFloat(speed);
        AppState.physics.gravity = parseFloat(gravity);
        
        const rad = THREE.MathUtils.degToRad(AppState.physics.angle);
        this.cannonBarrel.rotation.z = -rad;
        
        const v0 = AppState.physics.speed;
        const g = AppState.physics.gravity;
        
        const range = (Math.pow(v0, 2) * Math.sin(2 * rad)) / g;
        const maxH = (Math.pow(v0 * Math.sin(rad), 2)) / (2 * g);
        const flightTime = (2 * v0 * Math.sin(rad)) / g;
        
        AppState.physics.calculatedRange = range;
        AppState.physics.calculatedMaxH = maxH;
        AppState.physics.calculatedFlightTime = flightTime;
        
        this.targetRing.position.x = range;
        
        while (this.theoreticalCurveGroup.children.length > 0) {
            this.theoreticalCurveGroup.remove(this.theoreticalCurveGroup.children[0]);
        }
        
        const points = [];
        const steps = 50;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * flightTime;
            const x = v0 * Math.cos(rad) * t;
            const y = Math.max(0, (v0 * Math.sin(rad) * t) - (0.5 * g * Math.pow(t, 2))) + 0.8;
            points.push(new THREE.Vector3(x, y, 0));
        }
        
        const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
        const curveMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.6 });
        const dashedLine = new THREE.Line(curveGeo, curveMat);
        dashedLine.computeLineDistances();
        this.theoreticalCurveGroup.add(dashedLine);
        
        document.getElementById('hud-range').innerText = range.toFixed(1) + ' m';
        document.getElementById('hud-maxh').innerText = maxH.toFixed(1) + ' m';
        document.getElementById('hud-time').innerText = flightTime.toFixed(2) + ' s';
        
        if (!AppState.physics.isSimulating) {
            this.resetProjectile();
        }
    }
    
    launchProjectile() {
        AppState.physics.isSimulating = true;
        AppState.physics.simTime = 0;
        AppState.physics.trajectoryPoints = [];
        
        for (let i = 0; i < this.maxTrailPoints * 3; i++) {
            this.trailPositions[i] = 0;
        }
        this.trailGeometry.setDrawRange(0, 0);
        this.trailGeometry.attributes.position.needsUpdate = true;
        
        SoundFX.launch();
    }
    
    resetProjectile() {
        AppState.physics.isSimulating = false;
        AppState.physics.simTime = 0;
        AppState.physics.trajectoryPoints = [];
        this.projectileBall.position.set(0, 1.0, 0);
        this.trailGeometry.setDrawRange(0, 0);
        this.trailGeometry.attributes.position.needsUpdate = true;
        this.impactRing.material.opacity = 0;
    }
    
    stepPhysicsSimulation(delta) {
        if (!AppState.physics.isSimulating) return;
        
        AppState.physics.simTime += delta;
        const t = AppState.physics.simTime;
        
        const rad = THREE.MathUtils.degToRad(AppState.physics.angle);
        const v0 = AppState.physics.speed;
        const g = AppState.physics.gravity;
        
        const x = v0 * Math.cos(rad) * t;
        const y = (v0 * Math.sin(rad) * t) - (0.5 * g * Math.pow(t, 2)) + 0.8;
        
        if (y <= 0 && t > 0.05) {
            this.projectileBall.position.set(x, 0.35, 0);
            AppState.physics.isSimulating = false;
            this.impactRing.position.set(x, 0.06, 0);
            this.impactRing.scale.set(1, 1, 1);
            this.impactRing.material.opacity = 0.9;
            SoundFX.bubble();
            return;
        }
        
        this.projectileBall.position.set(x, y, 0);
        
        AppState.physics.trajectoryPoints.push(new THREE.Vector3(x, y, 0));
        const pts = AppState.physics.trajectoryPoints;
        const count = Math.min(pts.length, this.maxTrailPoints);
        
        for (let i = 0; i < count; i++) {
            this.trailPositions[i * 3] = pts[i].x;
            this.trailPositions[i * 3 + 1] = pts[i].y;
            this.trailPositions[i * 3 + 2] = pts[i].z;
        }
        this.trailGeometry.setDrawRange(0, count);
        this.trailGeometry.attributes.position.needsUpdate = true;
        
        document.getElementById('hud-time').innerText = t.toFixed(2) + ' s';
        document.getElementById('hud-range').innerText = x.toFixed(1) + ' m';
        document.getElementById('hud-maxh').innerText = Math.max(0, y).toFixed(1) + ' m';
    }
    
    // ===================================================================
    // 3. CHEMISTRY UPGRADE: Manual Substance Selection Lab
    // Transparent Beaker, Dynamic Fluid Shading, Particle Bubbles & Explosions
    // ===================================================================
    buildChemistryScene() {
        // Stir Plate Base
        const plateBase = new THREE.Mesh(
            new THREE.BoxGeometry(8, 1.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
        );
        plateBase.position.set(0, 0.6, 0);
        this.chemistryGroup.add(plateBase);
        
        // Transparent Glass Beaker
        const beakerRadius = 3.0;
        const beakerHeight = 7.0;
        const glassGeo = new THREE.CylinderGeometry(beakerRadius, beakerRadius, beakerHeight, 32, 1, true);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.32,
            roughness: 0.15,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        this.beakerMesh = new THREE.Mesh(glassGeo, glassMat);
        this.beakerMesh.position.set(0, 1.2 + beakerHeight / 2, 0);
        this.chemistryGroup.add(this.beakerMesh);
        
        const bottomGeo = new THREE.CircleGeometry(beakerRadius, 32);
        const bottomMesh = new THREE.Mesh(bottomGeo, glassMat);
        bottomMesh.rotation.x = -Math.PI / 2;
        bottomMesh.position.set(0, 1.21, 0);
        this.chemistryGroup.add(bottomMesh);
        
        // Graduation Rings
        for (let i = 1; i <= 4; i++) {
            const markGeo = new THREE.TorusGeometry(beakerRadius + 0.02, 0.02, 6, 32);
            const markMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 });
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.position.set(0, 1.2 + i * 1.3, 0);
            mark.rotation.x = Math.PI / 2;
            this.chemistryGroup.add(mark);
        }
        
        // Fluid Inside Beaker
        this.liquidHeight = 4.0;
        const liquidGeo = new THREE.CylinderGeometry(beakerRadius - 0.06, beakerRadius - 0.06, this.liquidHeight, 32);
        this.liquidMat = new THREE.MeshStandardMaterial({
            color: 0xeab308,
            roughness: 0.25,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85
        });
        this.liquidMesh = new THREE.Mesh(liquidGeo, this.liquidMat);
        this.liquidMesh.position.set(0, 1.2 + this.liquidHeight / 2, 0);
        this.chemistryGroup.add(this.liquidMesh);
        
        // Stir Bar
        const stirGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12);
        const stirMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        this.stirBar = new THREE.Mesh(stirGeo, stirMat);
        this.stirBar.rotation.z = Math.PI / 2;
        this.stirBar.position.set(0, 1.35, 0);
        this.chemistryGroup.add(this.stirBar);
        
        // Rising Particle Bubbles (Spheres)
        this.bubbleCount = 80;
        this.bubbleGeo = new THREE.SphereGeometry(0.1, 8, 8);
        this.bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
        this.bubbles = [];
        this.bubblesGroup = new THREE.Group();
        
        for (let i = 0; i < this.bubbleCount; i++) {
            const bMesh = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
            const bData = {
                mesh: bMesh,
                x: (Math.random() - 0.5) * (beakerRadius * 1.5),
                y: 1.3 + Math.random() * this.liquidHeight,
                z: (Math.random() - 0.5) * (beakerRadius * 1.5),
                speed: 0.02 + Math.random() * 0.035,
                scale: 0.6 + Math.random() * 0.7
            };
            bMesh.position.set(bData.x, bData.y, bData.z);
            bMesh.scale.set(bData.scale, bData.scale, bData.scale);
            this.bubblesGroup.add(bMesh);
            this.bubbles.push(bData);
        }
        this.chemistryGroup.add(this.bubblesGroup);
        
        // 3D Explosion Spark Particles (Active during violent reactions e.g. Potassium)
        const sparkCount = 90;
        this.sparkGeo = new THREE.BufferGeometry();
        this.sparkPositions = new Float32Array(sparkCount * 3);
        this.sparkVelocities = [];
        for (let i = 0; i < sparkCount; i++) {
            this.sparkPositions[i * 3] = 0;
            this.sparkPositions[i * 3 + 1] = 5.2; // top of beaker
            this.sparkPositions[i * 3 + 2] = 0;
            this.sparkVelocities.push({
                vx: (Math.random() - 0.5) * 8.0,
                vy: 4.0 + Math.random() * 8.0,
                vz: (Math.random() - 0.5) * 8.0
            });
        }
        this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
        this.sparkMat = new THREE.PointsMaterial({
            color: 0xfbbf24,
            size: 0.45,
            transparent: true,
            opacity: 0.0 // starts hidden
        });
        this.sparkPoints = new THREE.Points(this.sparkGeo, this.sparkMat);
        this.chemistryGroup.add(this.sparkPoints);
        
        // Thermal Steam Particles
        const steamCount = 45;
        this.steamGeo = new THREE.BufferGeometry();
        this.steamPositions = new Float32Array(steamCount * 3);
        for (let i = 0; i < steamCount * 3; i += 3) {
            this.steamPositions[i] = (Math.random() - 0.5) * 1.8;
            this.steamPositions[i + 1] = 5.5 + Math.random() * 3.0;
            this.steamPositions[i + 2] = (Math.random() - 0.5) * 1.8;
        }
        this.steamGeo.setAttribute('position', new THREE.BufferAttribute(this.steamPositions, 3));
        this.steamMat = new THREE.PointsMaterial({
            color: 0xe0e7ff,
            size: 0.4,
            transparent: true,
            opacity: 0.0
        });
        this.steamPoints = new THREE.Points(this.steamGeo, this.steamMat);
        this.chemistryGroup.add(this.steamPoints);
        
        const chemGrid = new THREE.GridHelper(26, 26, 0xec4899, 0x1e293b);
        chemGrid.position.set(0, 0, 0);
        this.chemistryGroup.add(chemGrid);
    }
    
    // Execute chemical reaction when user clicks "Mix / React"
    mixSubstances(subA, subB) {
        AppState.chemistry.substanceA = subA;
        AppState.chemistry.substanceB = subB;
        
        const combo = subA + '+' + subB;
        let rxnTitle = 'Chemical Reaction';
        let eq = '';
        let targetCol = 0xeab308;
        let phVal = 7.0;
        let tempVal = 22.0;
        let speedFactor = 1.0;
        let isExplosive = false;
        
        if (combo === 'hcl+naoh' || combo === 'vinegar+naoh') {
            // Exothermic Acid-Base Neutralization
            rxnTitle = 'Acid-Base Neutralization';
            eq = '\\text{HCl}_{(aq)} + \\text{NaOH}_{(aq)} \\longrightarrow \\text{NaCl}_{(aq)} + \\text{H}_2\\text{O}_{(l)} + \\Delta H';
            targetCol = 0xec4899; // Basic magenta indicator
            phVal = 7.2;
            tempVal = 64.5;
            speedFactor = 1.4;
            this.steamMat.opacity = 0.5;
            SoundFX.bubble();
        } else if (combo === 'vinegar+baking_soda' || combo === 'hcl+baking_soda') {
            // Vigorous Gas Evolution Effervescence
            rxnTitle = 'Vigorous Carbon Dioxide Effervescence';
            eq = '\\text{CH}_3\\text{COOH} + \\text{NaHCO}_3 \\longrightarrow \\text{CH}_3\\text{COONa} + \\text{H}_2\\text{O} + \\text{CO}_2\\uparrow';
            targetCol = 0x67e8f9; // foamy bright cyan
            phVal = 6.8;
            tempVal = 19.8; // mild endothermic cooling
            speedFactor = 3.5; // Rapid bubbling
            this.steamMat.opacity = 0.2;
            SoundFX.bubble();
        } else if (combo === 'water+potassium' || combo === 'hcl+potassium' || combo === 'vinegar+potassium') {
            // Explosive Alkali Metal Reaction!
            rxnTitle = 'Violent Alkali Metal Oxidation & Explosion';
            eq = '2\\text{K}_{(s)} + 2\\text{H}_2\\text{O}_{(l)} \\longrightarrow 2\\text{KOH}_{(aq)} + \\text{H}_{2(g)}\\uparrow + \\text{Flame}';
            targetCol = 0x8b5cf6; // highly alkaline violet
            phVal = 13.8;
            tempVal = 92.5; // extremely hot!
            speedFactor = 4.0;
            isExplosive = true;
            this.trigger3DExplosion();
            SoundFX.explosion();
        } else if (combo === 'cuso4+naoh' || combo === 'cuso4+ammonia') {
            // Precipitation Reaction (Copper Hydroxide Complex)
            rxnTitle = 'Precipitation of Copper(II) Hydroxide';
            eq = '\\text{CuSO}_{4(aq)} + 2\\text{NaOH}_{(aq)} \\longrightarrow \\text{Cu(OH)}_{2(s)}\\downarrow + \\text{Na}_2\\text{SO}_{4(aq)}';
            targetCol = 0x1d4ed8; // Deep royal blue complex
            phVal = 9.4;
            tempVal = 29.0;
            speedFactor = 0.9;
            this.liquidMat.opacity = 0.95;
            SoundFX.bubble();
        } else if (combo === 'hcl+zinc') {
            // Single Displacement Hydrogen Gas
            rxnTitle = 'Single Displacement: Hydrogen Gas Evolution';
            eq = '\\text{Zn}_{(s)} + 2\\text{HCl}_{(aq)} \\longrightarrow \\text{ZnCl}_{2(aq)} + \\text{H}_{2(g)}\\uparrow';
            targetCol = 0x94a3b8; // metallic clear gray
            phVal = 3.5;
            tempVal = 44.0;
            speedFactor = 2.4;
            this.steamMat.opacity = 0.35;
            SoundFX.bubble();
        } else {
            // General solution mixing
            rxnTitle = 'Aqueous Dissolution & Equilibrium';
            eq = '\\text{Substance A} + \\text{Substance B} \\rightleftharpoons \\text{Solution Equilibrium}';
            targetCol = 0x38bdf8;
            phVal = 7.0;
            tempVal = 23.0;
            speedFactor = 1.0;
            SoundFX.click();
        }
        
        AppState.chemistry.reactionName = rxnTitle;
        AppState.chemistry.equation = eq;
        AppState.chemistry.targetColor = targetCol;
        AppState.chemistry.ph = phVal;
        AppState.chemistry.temp = tempVal;
        AppState.chemistry.bubbleSpeedFactor = speedFactor;
        
        // Update HUD
        document.getElementById('hud-ph').innerText = phVal.toFixed(1);
        document.getElementById('hud-temp').innerText = tempVal.toFixed(1) + '°C';
        document.getElementById('hud-rxn').innerText = rxnTitle.split(' ')[0] + ' ' + (rxnTitle.split(' ')[1] || '');
    }
    
    trigger3DExplosion() {
        AppState.chemistry.hasExplosion = true;
        AppState.chemistry.explosionTime = 0;
        this.sparkMat.opacity = 1.0;
        
        // Reset spark positions to mouth of beaker
        const count = 90;
        for (let i = 0; i < count; i++) {
            this.sparkPositions[i * 3] = (Math.random() - 0.5) * 1.5;
            this.sparkPositions[i * 3 + 1] = 5.2;
            this.sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
            this.sparkVelocities[i] = {
                vx: (Math.random() - 0.5) * 10.0,
                vy: 5.0 + Math.random() * 9.0,
                vz: (Math.random() - 0.5) * 10.0
            };
        }
        this.sparkGeo.attributes.position.needsUpdate = true;
        this.steamMat.opacity = 0.85;
    }
    
    toggleStirring() {
        AppState.chemistry.isStirring = !AppState.chemistry.isStirring;
        SoundFX.click();
    }
    
    resetChemistryBeaker() {
        AppState.chemistry.isStirring = false;
        AppState.chemistry.targetColor = 0xeab308;
        AppState.chemistry.ph = 7.0;
        AppState.chemistry.temp = 22.0;
        AppState.chemistry.bubbleSpeedFactor = 1.0;
        this.steamMat.opacity = 0.0;
        this.sparkMat.opacity = 0.0;
        this.liquidMat.opacity = 0.85;
        this.liquidMat.color.setHex(0xeab308);
        document.getElementById('hud-ph').innerText = '7.0';
        document.getElementById('hud-temp').innerText = '22.0°C';
        document.getElementById('hud-rxn').innerText = 'Clean Solution';
        SoundFX.click();
    }
    
    stepChemistrySimulation(delta) {
        // Fluid color lerp
        this.liquidMat.color.lerp(new THREE.Color(AppState.chemistry.targetColor), delta * 2.5);
        
        // Spin stir bar
        if (AppState.chemistry.isStirring) {
            this.stirBar.rotation.y += delta * 16.0;
        }
        
        // Animate rising bubbles with speed factor
        const topY = 1.2 + this.liquidHeight;
        const spdMul = AppState.chemistry.bubbleSpeedFactor * (AppState.chemistry.isStirring ? 1.6 : 1.0);
        
        for (let i = 0; i < this.bubbles.length; i++) {
            const b = this.bubbles[i];
            b.y += b.speed * spdMul;
            b.x += Math.sin(b.y * 3.5) * 0.012;
            if (b.y > topY) {
                b.y = 1.35;
                b.x = (Math.random() - 0.5) * 4.2;
                b.z = (Math.random() - 0.5) * 4.2;
            }
            b.mesh.position.set(b.x, b.y, b.z);
        }
        
        // Animate 3D Explosion sparks if active
        if (AppState.chemistry.hasExplosion) {
            AppState.chemistry.explosionTime += delta;
            const count = 90;
            for (let i = 0; i < count; i++) {
                const vel = this.sparkVelocities[i];
                this.sparkPositions[i * 3] += vel.vx * delta;
                this.sparkPositions[i * 3 + 1] += vel.vy * delta;
                this.sparkPositions[i * 3 + 2] += vel.vz * delta;
                vel.vy -= 18.0 * delta; // gravity pulls sparks down
            }
            this.sparkGeo.attributes.position.needsUpdate = true;
            this.sparkMat.opacity -= delta * 0.9;
            if (AppState.chemistry.explosionTime > 1.2) {
                AppState.chemistry.hasExplosion = false;
                this.sparkMat.opacity = 0.0;
            }
        }
        
        // Animate steam particles
        if (this.steamMat.opacity > 0.05) {
            const pos = this.steamGeo.attributes.position.array;
            for (let i = 1; i < pos.length; i += 3) {
                pos[i] += delta * 1.6;
                if (pos[i] > 9.5) pos[i] = 5.5;
            }
            this.steamGeo.attributes.position.needsUpdate = true;
        }
    }
    
    // ===================================================================
    // Interaction & Animation Helpers
    // ===================================================================
    onCanvasClick(e) {
        if (AppState.currentSubject !== 'biology') return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.anatomyOrgans, true);
        
        if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj && (!obj.userData || !obj.userData.name) && obj.parent) {
                obj = obj.parent;
            }
            if (obj && obj.userData && obj.userData.name) {
                SoundFX.snap();
                this.showRaycastTooltip({
                    icon: obj.userData.organIcon || '🫀',
                    title: obj.userData.name,
                    desc: obj.userData.desc
                });
            }
        }
    }
    
    onCanvasMouseMove(e) {
        if (AppState.currentSubject !== 'biology') return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.anatomyOrgans, true);
        this.canvas.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    }
    
    showRaycastTooltip(info) {
        const tooltip = document.getElementById('raycast-tooltip');
        document.getElementById('tooltip-organelle-icon').innerText = info.icon || '🫀';
        document.getElementById('tooltip-organelle-title').innerText = info.title || 'Organ';
        document.getElementById('tooltip-organelle-desc').innerText = info.desc || '';
        tooltip.classList.remove('hidden');
    }
    
    tweenPosition(obj, targetPos, duration) {
        const dur = duration || 450;
        const startPos = obj.position.clone();
        const startTime = performance.now();
        function update() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / dur, 1.0);
            const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
            obj.position.lerpVectors(startPos, targetPos, ease);
            if (progress < 1.0) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
    
    tweenCamera(targetPos, targetLookAt, duration) {
        const dur = duration || 500;
        const startPos = this.camera.position.clone();
        const startLook = this.controls ? this.controls.target.clone() : new THREE.Vector3();
        const startTime = performance.now();
        const cam = this.camera;
        const ctrl = this.controls;
        function update() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / dur, 1.0);
            const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
            cam.position.lerpVectors(startPos, targetPos, ease);
            if (ctrl) {
                ctrl.target.lerpVectors(startLook, targetLookAt, ease);
                ctrl.update();
            }
            if (progress < 1.0) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Auto-rotation for human body
        if (AppState.autoRotate && AppState.currentSubject === 'biology') {
            this.biologyGroup.rotation.y += delta * 0.25;
            
            // Heartbeat rhythmic pulsation
            if (this.heartGroup) {
                const heartScale = 1.0 + Math.sin(time * 6.5) * 0.05;
                this.heartGroup.scale.set(heartScale, heartScale, heartScale);
            }
            
            // Lung respiratory breathing expansion
            if (this.lungsGroup) {
                const lungScale = 1.0 + Math.sin(time * 2.2) * 0.035;
                this.lungsGroup.scale.set(lungScale, lungScale, lungScale);
            }
        }
        
        if (AppState.currentSubject === 'physics') {
            this.stepPhysicsSimulation(delta);
            if (this.impactRing.material.opacity > 0) {
                this.impactRing.scale.addScalar(delta * 2.5);
                this.impactRing.material.opacity -= delta * 1.5;
            }
        } else if (AppState.currentSubject === 'chemistry') {
            this.stepChemistrySimulation(delta);
        }
        
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    // Canvas Snapshot (renderer.domElement.toDataURL)
    captureSnapshot() {
        this.renderer.render(this.scene, this.camera);
        return this.canvas.toDataURL('image/png');
    }
}

// ===================================================================
// AI Multimodal Tutor Chat Interface
// ===================================================================
class AITutorChat {
    constructor(engine) {
        this.engine = engine;
        this.messagesContainer = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.userInput = document.getElementById('user-input');
        this.snapPreviewBox = document.getElementById('snap-preview-box');
        this.snapPreviewImg = document.getElementById('snap-preview-img');
        this.synth = window.speechSynthesis;
        
        this.initChatEvents();
        this.sendSubjectGreeting('biology');
    }
    
    initChatEvents() {
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUserSubmit();
        });
        
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserSubmit();
            }
        });
    }
    
    snapCanvas() {
        SoundFX.snap();
        const dataUrl = this.engine.captureSnapshot();
        AppState.activeSnapshot = dataUrl;
        this.snapPreviewImg.src = dataUrl;
        this.snapPreviewBox.classList.remove('hidden');
        this.userInput.focus();
    }
    
    clearSnapshot() {
        AppState.activeSnapshot = null;
        this.snapPreviewBox.classList.add('hidden');
        this.snapPreviewImg.src = '';
        SoundFX.click();
    }
    
    sendSubjectGreeting(subject) {
        let tutorName = 'Dr. Helix';
        let tutorAvatar = '🧬';
        let welcomeText = '';
        
        if (subject === 'biology') {
            tutorName = 'Dr. Helix';
            tutorAvatar = '🧬';
            welcomeText = "👋 **Greetings, STEM Scholar! I am Dr. Helix**, your 3D Human Anatomy & Physiology Tutor.\n\n" +
                "- Examine the **3D Human Anatomy model** on your left with its transparent torso.\n" +
                "- Click directly on the **Liver**, **Heart**, or **Lungs** to highlight their internal structures.\n" +
                "- Click **Dissect Organs** to expand them outward, or hit 📸 **Snap 3D & Ask AI** to analyze any organ!";
        } else if (subject === 'physics') {
            tutorName = 'Prof. Newton';
            tutorAvatar = '⚡';
            welcomeText = "👋 **Welcome to the Kinematics Lab! I am Prof. Newton.**\n\n" +
                "- Adjust the **launch angle θ**, **velocity v₀**, and **planetary gravity**.\n" +
                "- Hit **Launch Projectile** to observe the trajectory parabola in real-time.\n" +
                "- Snap the 3D trajectory curve and ask me about kinematic equations and range optimization!";
        } else if (subject === 'chemistry') {
            tutorName = 'Dr. Curie';
            tutorAvatar = '🧪';
            welcomeText = "👋 **Welcome to the Chemical Reaction Lab! I am Dr. Curie.**\n\n" +
                "- Choose **Substance A** and **Substance B** from the dropdown selectors.\n" +
                "- Click **Mix / React** to trigger dynamic 3D chemical reactions (Acid-Base shifts, effervescence, or explosive potassium redox!).\n" +
                "- Snap the 3D beaker view to ask me about stoichiometry, molecular bonds, and balanced equations!";
        }
        
        this.appendMessage({
            sender: 'tutor',
            tutorName: tutorName,
            avatar: tutorAvatar,
            text: welcomeText
        });
    }
    
    gatherTelemetry() {
        if (AppState.currentSubject === 'biology') {
            return {
                selectedOrgan: AppState.biology.focusOrgan,
                exploded: AppState.biology.exploded,
                ghostTorso: AppState.biology.ghostTorso
            };
        } else if (AppState.currentSubject === 'physics') {
            return {
                angle: AppState.physics.angle,
                velocity: AppState.physics.speed,
                gravity: AppState.physics.gravity,
                range: AppState.physics.calculatedRange,
                maxHeight: AppState.physics.calculatedMaxH,
                flightTime: AppState.physics.calculatedFlightTime
            };
        } else if (AppState.currentSubject === 'chemistry') {
            return {
                substanceA: AppState.chemistry.substanceA,
                substanceB: AppState.chemistry.substanceB,
                reactionName: AppState.chemistry.reactionName,
                equation: AppState.chemistry.equation,
                ph: AppState.chemistry.ph,
                temp: AppState.chemistry.temp,
                isStirring: AppState.chemistry.isStirring
            };
        }
        return {};
    }
    
    async handleUserSubmit() {
        const text = this.userInput.value.trim();
        if (!text) return;
        
        const attachedSnapshot = AppState.activeSnapshot;
        
        this.appendMessage({
            sender: 'user',
            text: text,
            snapshot: attachedSnapshot
        });
        
        this.userInput.value = '';
        this.clearSnapshot();
        SoundFX.snap();
        
        const typingEl = this.showTypingIndicator();
        
        const payload = {
            message: text,
            subject: AppState.currentSubject,
            image: attachedSnapshot,
            telemetry: this.gatherTelemetry(),
            apiKey: localStorage.getItem('gemini_api_key') || ''
        };
        
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            this.removeTypingIndicator(typingEl);
            
            if (data.response) {
                this.appendMessage({
                    sender: 'tutor',
                    tutorName: data.tutor || 'Tutor',
                    avatar: data.avatar || '🎓',
                    text: data.response
                });
                if (AppState.ttsEnabled) {
                    this.speakText(data.response);
                }
            } else {
                this.appendMessage({
                    sender: 'tutor',
                    tutorName: 'Tutor',
                    avatar: '⚠️',
                    text: 'I encountered an issue processing your query. Please try again.'
                });
            }
        } catch (err) {
            console.error('Chat error:', err);
            this.removeTypingIndicator(typingEl);
            this.appendMessage({
                sender: 'tutor',
                tutorName: 'Tutor',
                avatar: '⚠️',
                text: 'Unable to reach backend server. Please verify Flask is running.'
            });
        }
    }
    
    appendMessage(msgData) {
        const msg = document.createElement('div');
        msg.className = 'message ' + msgData.sender;
        
        let contentHtml = '';
        if (msgData.snapshot) {
            contentHtml += '<img src="' + msgData.snapshot + '" class="message-snapshot-img" alt="3D View Snapshot">';
        }
        
        let parsedText = msgData.text || '';
        if (window.marked) {
            try {
                parsedText = marked.parse(parsedText);
            } catch (e) {}
        }
        contentHtml += parsedText;
        
        const avatarIcon = msgData.avatar || (msgData.sender === 'user' ? '👤' : '🎓');
        const displayName = msgData.sender === 'user' ? 'You' : (msgData.tutorName || 'AI Tutor');
        
        msg.innerHTML = 
            '<div class="message-avatar">' + avatarIcon + '</div>' +
            '<div class="message-body">' +
                '<div class="message-bubble">' + contentHtml + '</div>' +
                '<div class="message-meta">' +
                    '<span>' + displayName + '</span>' +
                    (msgData.sender === 'tutor' ? '<button class="tts-speak-btn" title="Read Aloud">🔊 Listen</button>' : '') +
                '</div>' +
            '</div>';
            
        if (msgData.sender === 'tutor') {
            const btn = msg.querySelector('.tts-speak-btn');
            if (btn) {
                btn.addEventListener('click', () => this.speakText(msgData.text));
            }
        }
        
        this.messagesContainer.appendChild(msg);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    showTypingIndicator() {
        const typing = document.createElement('div');
        typing.className = 'message tutor typing-container';
        typing.innerHTML = 
            '<div class="message-avatar">🤔</div>' +
            '<div class="typing-indicator">' +
                '<span class="typing-dot"></span>' +
                '<span class="typing-dot"></span>' +
                '<span class="typing-dot"></span>' +
            '</div>';
        this.messagesContainer.appendChild(typing);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        return typing;
    }
    
    removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }
    
    speakText(markdownText) {
        if (!('speechSynthesis' in window)) return;
        const plainText = markdownText
            .replace(/[#*_`~>\[\]]/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\$\$[\s\S]*?\$\$/g, 'formula')
            .trim();
        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.05;
        this.synth.speak(utterance);
    }
}

// ===================================================================
// Global Application Initialization & Window Function Bindings
// ===================================================================
let engineInstance = null;
let chatInstance = null;

function initApp() {
    if (engineInstance) return;
    
    engineInstance = new ThreeEngine();
    chatInstance = new AITutorChat(engineInstance);
    
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        const inputApiKey = document.getElementById('input-api-key');
        if (inputApiKey) inputApiKey.value = savedKey;
        const statusLabel = document.getElementById('status-label');
        if (statusLabel) statusLabel.innerText = 'Gemini Live';
    }
    
    if (window.lucide) lucide.createIcons();
}

// Global functions for inline HTML event handlers
window.switchSubject = function(subject) {
    if (!engineInstance) initApp();
    
    const tabs = {
        biology: document.getElementById('tab-biology'),
        physics: document.getElementById('tab-physics'),
        chemistry: document.getElementById('tab-chemistry')
    };
    Object.keys(tabs).forEach(key => {
        if (tabs[key]) tabs[key].classList.toggle('active', key === subject);
    });
    
    const panels = {
        biology: document.getElementById('controls-biology'),
        physics: document.getElementById('controls-physics'),
        chemistry: document.getElementById('controls-chemistry')
    };
    Object.keys(panels).forEach(key => {
        if (panels[key]) panels[key].classList.toggle('hidden', key !== subject);
    });
    
    engineInstance.switchSubject(subject);
    
    const sceneBadge = {
        icon: document.getElementById('scene-icon'),
        title: document.getElementById('scene-title'),
        desc: document.getElementById('scene-desc')
    };
    const tutorProfile = {
        avatar: document.getElementById('tutor-avatar'),
        name: document.getElementById('tutor-name'),
        specialty: document.getElementById('tutor-specialty')
    };
    
    if (subject === 'biology') {
        sceneBadge.icon.innerText = '🫀';
        sceneBadge.title.innerText = '3D Human Body Anatomy';
        sceneBadge.desc.innerText = 'Interactive transparent torso with internal Liver, Heart, and Lungs';
        tutorProfile.avatar.innerText = '🧬';
        tutorProfile.name.innerText = 'Dr. Helix';
        tutorProfile.specialty.innerText = '3D Human Anatomy & Organ Specialist';
    } else if (subject === 'physics') {
        sceneBadge.icon.innerText = '⚡';
        sceneBadge.title.innerText = 'Projectile Kinematics Lab';
        sceneBadge.desc.innerText = '3D ballistic trajectory simulation & planetary gravity';
        tutorProfile.avatar.innerText = '⚡';
        tutorProfile.name.innerText = 'Prof. Newton';
        tutorProfile.specialty.innerText = 'Kinematics & Ballistic Mechanics Specialist';
    } else if (subject === 'chemistry') {
        sceneBadge.icon.innerText = '🧪';
        sceneBadge.title.innerText = 'Chemical Reaction & Beaker Lab';
        sceneBadge.desc.innerText = 'Manual substance selection, acid-base shifts, effervescence & explosions';
        tutorProfile.avatar.innerText = '🧪';
        tutorProfile.name.innerText = 'Dr. Curie';
        tutorProfile.specialty.innerText = 'Reaction Kinetics & Molecular Lab Specialist';
    }
    
    chatInstance.sendSubjectGreeting(subject);
    SoundFX.click();
};

window.triggerSnapCanvas = function() {
    if (!chatInstance) initApp();
    chatInstance.snapCanvas();
};

window.clearSnapshot = function() {
    if (chatInstance) chatInstance.clearSnapshot();
};

window.resetCamera = function() {
    if (engineInstance) engineInstance.resetCamera();
};

window.toggleRotation = function() {
    AppState.autoRotate = !AppState.autoRotate;
    SoundFX.click();
};

// Biology Anatomical Controls
window.toggleBiologyExplode = function() {
    if (engineInstance) engineInstance.toggleBiologyExplode();
};

window.toggleBiologySlice = function() {
    if (engineInstance) engineInstance.toggleBiologySlice();
};

window.focusOrganelle = function(org) {
    if (!engineInstance) return;
    document.querySelectorAll('#organelle-select-group .pill-option').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector('#organelle-select-group [data-organelle="' + org + '"]');
    if (btn) btn.classList.add('active');
    engineInstance.focusOrgan(org);
};

window.askAboutSelected = function() {
    const title = document.getElementById('tooltip-organelle-title').innerText;
    document.getElementById('user-input').value = 'Explain the anatomical structure, blood supply, and physiological role of the ' + title + ' in the human body.';
    window.triggerSnapCanvas();
    chatInstance.handleUserSubmit();
};

// Physics Controls
window.syncPhysicsUI = function() {
    if (!engineInstance) return;
    const angle = document.getElementById('input-angle').value;
    const speed = document.getElementById('input-speed').value;
    const gravity = document.getElementById('select-gravity').value;
    document.getElementById('val-angle').innerText = angle + '°';
    document.getElementById('val-speed').innerText = speed + ' m/s';
    engineInstance.updatePhysicsParameters(angle, speed, gravity);
};

window.launchProjectile = function() {
    if (engineInstance) engineInstance.launchProjectile();
};

window.resetProjectile = function() {
    if (engineInstance) engineInstance.resetProjectile();
};

// Chemistry Manual Substance Controls
window.mixAndReact = function() {
    if (!engineInstance) initApp();
    const selA = document.getElementById('select-substance-a');
    const selB = document.getElementById('select-substance-b');
    const subA = selA ? selA.value : 'hcl';
    const subB = selB ? selB.value : 'naoh';
    engineInstance.mixSubstances(subA, subB);
};

window.toggleStirring = function() {
    if (engineInstance) engineInstance.toggleStirring();
};

window.resetChemistryBeaker = function() {
    if (engineInstance) engineInstance.resetChemistryBeaker();
};

// AI Chat Helpers
window.sendQuickQuery = function(query) {
    const input = document.getElementById('user-input');
    input.value = query;
    if (chatInstance) chatInstance.handleUserSubmit();
    SoundFX.click();
};

window.clearChat = function() {
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    if (chatInstance) chatInstance.sendSubjectGreeting(AppState.currentSubject);
    SoundFX.click();
};

window.toggleSpeech = function() {
    AppState.ttsEnabled = !AppState.ttsEnabled;
    const icon = document.getElementById('speech-icon');
    if (icon) {
        icon.setAttribute('data-lucide', AppState.ttsEnabled ? 'volume-2' : 'volume-x');
        if (window.lucide) lucide.createIcons();
    }
    SoundFX.click();
};

window.openSettings = function() {
    document.getElementById('modal-settings').classList.remove('hidden');
    SoundFX.click();
};

window.closeSettings = function() {
    document.getElementById('modal-settings').classList.add('hidden');
    SoundFX.click();
};

window.saveApiKey = async function() {
    const key = document.getElementById('input-api-key').value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        document.getElementById('status-label').innerText = 'Gemini Live';
        try {
            await fetch('/api/set-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });
        } catch (e) {}
    }
    window.closeSettings();
    SoundFX.snap();
};

window.openGuide = function() {
    document.getElementById('modal-guide').classList.remove('hidden');
    SoundFX.click();
};

window.closeGuide = function() {
    document.getElementById('modal-guide').classList.add('hidden');
    SoundFX.click();
};

window.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
    SoundFX.click();
};

// Initialize Application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
