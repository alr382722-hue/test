// Three.js Airplane Dodge Game
// Complete 3D game with airplane that avoids floating obstacles

class AirplaneDodgeGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.airplane = null;
        this.obstacles = [];
        this.particles = [];
        this.score = 0;
        this.gameSpeed = 1.0; // Enhanced initial speed
        this.gameStarted = false;
        this.gameOver = false;
        this.keys = {};
        this.clock = new THREE.Clock();

        // Enhanced game settings
        this.airplaneSpeed = 0.8; // Balanced speed for better gameplay
        this.baseAirplaneSpeed = 0.8; // Base speed for reference
        this.obstacleSpawnDistance = 100;
        this.obstacleCount = 0; // No initial obstacles - start clean
        this.worldSize = 200;
        this.particleCount = 50;
        this.lastSpawnTime = 0;
        this.spawnInterval = 1500; // Balanced spawning - every 1.5 seconds
        this.multiSpawnCount = 2; // Spawn two obstacles at a time
        this.gameStartDelay = 1000; // 1 second delay - obstacles already pre-generated

        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLighting();
        this.createAirplane();
        this.createObstacles();
        this.createParticles();
        this.setupControls();
        this.setupEventListeners();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Background sky color
        const fogColor = new THREE.Color(0x87CEEB);
        this.scene.background = fogColor;
        this.scene.fog = null; // Remove fog
        
        // Create beautiful skybox
        this.createSkybox();
        
        this.createBoundaries();
    }

    createSkybox() {
        // Simple background color instead of sphere skybox - no more large circle effect
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Add floating clouds
        this.createClouds();
        
        // Add ocean/sea
        this.createOcean();
    }

    createClouds() {
        this.clouds = [];
        const cloudMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFFFFF, 
            transparent: true, 
            opacity: 0.8,
            shininess: 0,
            flatShading: true
        });
        
        const numClouds = 30;
        
        for (let i = 0; i < numClouds; i++) {
            const cloudGroup = new THREE.Group();
            
            // Create cloud with multiple spheres
            const cloudSize = 8 + Math.random() * 15;
            const numSpheres = 3 + Math.floor(Math.random() * 4);
            
            for (let j = 0; j < numSpheres; j++) {
                const sphereGeometry = new THREE.SphereGeometry(
                    cloudSize * (0.5 + Math.random() * 0.5),
                    8, 6
                );
                const sphere = new THREE.Mesh(sphereGeometry, cloudMaterial);
                sphere.position.set(
                    (Math.random() - 0.5) * cloudSize,
                    (Math.random() - 0.5) * cloudSize * 0.5,
                    (Math.random() - 0.5) * cloudSize
                );
                cloudGroup.add(sphere);
            }
            
            // Position clouds randomly in the sky
            cloudGroup.position.set(
                (Math.random() - 0.5) * 800,
                50 + Math.random() * 150,
                (Math.random() - 0.5) * 800
            );
            
            cloudGroup.rotation.x = Math.random() * Math.PI;
            cloudGroup.rotation.y = Math.random() * Math.PI;
            cloudGroup.rotation.z = Math.random() * Math.PI;
            
            this.scene.add(cloudGroup);
            this.clouds.push(cloudGroup);
        }
    }

    createOcean() {
        // Create ocean water surface
        const oceanGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
        
        // Create water material with shader
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color1: { value: new THREE.Color(0x006994) }, // Deep blue
                color2: { value: new THREE.Color(0x4FC3F7) }, // Light blue
                color3: { value: new THREE.Color(0x87CEEB) }  // Sky blue
            },
            fog: true,
            vertexShader: `
                uniform float time;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                #include <fog_pars_vertex>
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    vec3 pos = position;
                    pos.z += sin(pos.x * 0.1 + time) * 0.5;
                    pos.z += sin(pos.y * 0.1 + time * 0.7) * 0.3;
                    pos.z += sin(pos.x * 0.05 + pos.y * 0.05 + time * 1.2) * 0.2;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                #include <fog_pars_fragment>
                
                void main() {
                    float wave1 = sin(vPosition.x * 0.1 + time) * 0.5 + 0.5;
                    float wave2 = sin(vPosition.y * 0.1 + time * 0.7) * 0.5 + 0.5;
                    float wave3 = sin(vPosition.x * 0.05 + vPosition.y * 0.05 + time * 1.2) * 0.5 + 0.5;
                    
                    vec3 color = mix(color1, color2, wave1);
                    color = mix(color, color3, wave2 * 0.3);
                    
                    float alpha = 0.8 + wave3 * 0.2;
                    gl_FragColor = vec4(color, alpha);
                    
                    // Apply scene fog for smooth horizon fade
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const ocean = new THREE.Mesh(oceanGeometry, waterMaterial);
        ocean.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ocean.position.y = -20; // Fixed sea level (used for barrier)
        ocean.receiveShadow = true;
        ocean.userData = { isOcean: true }; // Mark as ocean to avoid collision detection
        
        this.scene.add(ocean);
        this.ocean = ocean;
        this.oceanBaseY = ocean.position.y; // Store fixed sea level for barrier
        this.oceanTiles = [ocean]; // Track ocean tiles
        this.oceanTileSize = 2000; // Size of each ocean tile
        this.oceanGenerationDistance = 3000; // Distance to generate new tiles
        this.oceanCleanupDistance = 5000; // Distance to remove old tiles
        
        // Create underwater elements
        this.createUnderwaterElements();
    }
    
    createOceanTile(x, z) {
        // Create a new ocean tile at specified position
        const oceanGeometry = new THREE.PlaneGeometry(this.oceanTileSize, this.oceanTileSize, 100, 100);
        
        // Create water material with shader
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color1: { value: new THREE.Color(0x006994) }, // Deep blue
                color2: { value: new THREE.Color(0x4FC3F7) }, // Light blue
                color3: { value: new THREE.Color(0x87CEEB) }  // Sky blue
            },
            fog: true,
            vertexShader: `
                uniform float time;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                #include <fog_pars_vertex>
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    vec3 pos = position;
                    pos.z += sin(pos.x * 0.1 + time) * 0.5;
                    pos.z += sin(pos.y * 0.1 + time * 0.7) * 0.3;
                    pos.z += sin(pos.x * 0.05 + pos.y * 0.05 + time * 1.2) * 0.2;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                #include <fog_pars_fragment>
                
                void main() {
                    float wave1 = sin(vPosition.x * 0.1 + time) * 0.5 + 0.5;
                    float wave2 = sin(vPosition.y * 0.1 + time * 0.7) * 0.5 + 0.5;
                    float wave3 = sin(vPosition.x * 0.05 + vPosition.y * 0.05 + time * 1.2) * 0.5 + 0.5;
                    
                    vec3 color = mix(color1, color2, wave1);
                    color = mix(color, color3, wave2 * 0.3);
                    
                    float alpha = 0.8 + wave3 * 0.2;
                    gl_FragColor = vec4(color, alpha);
                    
                    // Apply scene fog for smooth horizon fade
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const oceanTile = new THREE.Mesh(oceanGeometry, waterMaterial);
        oceanTile.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        oceanTile.position.set(x, this.oceanBaseY, z);
        oceanTile.receiveShadow = true;
        oceanTile.userData = { isOcean: true, tileX: x, tileZ: z };
        
        this.scene.add(oceanTile);
        this.oceanTiles.push(oceanTile);
        
        return oceanTile;
    }
    
    createUnderwaterElements() {
        for (let i = 0; i < 15; i++) {
            const coralGeometry = new THREE.ConeGeometry(
                3 + Math.random() * 4,
                8 + Math.random() * 12,
                6
            );
            const coralMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(
                    0.8 + Math.random() * 0.2, // Pink to purple range
                    0.7 + Math.random() * 0.3,
                    0.4 + Math.random() * 0.3
                ),
                transparent: true,
                opacity: 0.8
            });
            
            const coral = new THREE.Mesh(coralGeometry, coralMaterial);
            coral.position.set(
                (Math.random() - 0.5) * 1500,
                -40 - Math.random() * 40, // Place closer to surface
                (Math.random() - 0.5) * 1500
            );
            coral.rotation.z = Math.random() * Math.PI * 2;
            coral.castShadow = true;
            coral.receiveShadow = true;
            
            this.scene.add(coral);
        }
        
        // Create sea plants
        for (let i = 0; i < 25; i++) {
            const plantGeometry = new THREE.CylinderGeometry(
                0.2 + Math.random() * 0.3,
                0.5 + Math.random() * 0.5,
                5 + Math.random() * 10,
                6
            );
            const plantMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(
                    0.3 + Math.random() * 0.2, // Green range
                    0.6 + Math.random() * 0.4,
                    0.3 + Math.random() * 0.4
                ),
                transparent: true,
                opacity: 0.7
            });
            
            const plant = new THREE.Mesh(plantGeometry, plantMaterial);
            plant.position.set(
                (Math.random() - 0.5) * 1800,
                -35 - Math.random() * 30, // Place closer to surface
                (Math.random() - 0.5) * 1800
            );
            plant.rotation.z = Math.random() * Math.PI * 2;
            plant.castShadow = true;
            plant.receiveShadow = true;
            
            this.scene.add(plant);
        }
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, -50);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB);

        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);
    }

    setupLighting() {
        // Dynamic sun lighting system
        this.sunLight = new THREE.DirectionalLight(0xFFE4B5, 2.0);
        this.sunLight.position.set(100, 150, 50);
        this.sunLight.castShadow = true;
        
        // High-quality shadows
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 0.1;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -200;
        this.sunLight.shadow.camera.right = 200;
        this.sunLight.shadow.camera.top = 200;
        this.sunLight.shadow.camera.bottom = -200;
        this.sunLight.shadow.bias = -0.0001;
        
        this.scene.add(this.sunLight);

        // Ambient light for overall illumination
        this.ambientLight = new THREE.AmbientLight(0x87CEEB, 0.4);
        this.scene.add(this.ambientLight);

        // Hemisphere light for realistic sky colors
        this.hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x4682B4, 1.2);
        this.scene.add(this.hemisphereLight);

        // Moon light (cooler, dimmer)
        this.moonLight = new THREE.DirectionalLight(0xB0C4DE, 0.3);
        this.moonLight.position.set(-50, 100, -30);
        this.scene.add(this.moonLight);

        // Atmospheric point lights for depth
        this.atmosphericLights = [];
        for (let i = 0; i < 5; i++) {
            const light = new THREE.PointLight(
                new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.3, 0.5),
                0.5,
                100
            );
            light.position.set(
                (Math.random() - 0.5) * 200,
                20 + Math.random() * 50,
                (Math.random() - 0.5) * 200
            );
            this.scene.add(light);
            this.atmosphericLights.push(light);
        }

        // Engine glow lights
        this.engineLights = [];
        const engineLightMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF4500,
            emissive: 0xFF4500,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < 2; i++) {
            const engineLight = new THREE.PointLight(0xFF4500, 1.0, 20);
            engineLight.position.set(i === 0 ? -2.5 : 2.5, 0, -1);
            this.scene.add(engineLight);
            this.engineLights.push(engineLight);
        }
    }

    createAirplane() {
        // Create airplane group
        this.airplane = new THREE.Group();

        // Ultra-realistic materials with metallic properties
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xE8E8E8, 
            shininess: 200,
            specular: 0x444444,
            reflectivity: 0.3
        });
        const accentMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2C2C2C, 
            shininess: 150,
            specular: 0x222222
        });
        const glassMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x87CEEB, 
            transparent: true, 
            opacity: 0.3, 
            shininess: 300,
            specular: 0xFFFFFF
        });
        const engineMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1A1A1A, 
            shininess: 100,
            specular: 0x333333
        });
        const propellerMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513, 
            shininess: 50
        });

        // Fuselage Group - this will be the main connecting body
        const fuselageGroup = new THREE.Group();

        // Main fuselage (more detailed and realistic)
        const fuselageGeometry = new THREE.CylinderGeometry(0.6, 0.7, 6, 16);
        const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
        fuselage.rotation.z = Math.PI / 2; // Orient along Z-axis
        fuselage.castShadow = true;
        fuselage.receiveShadow = true;
        fuselageGroup.add(fuselage);

        // Nose cone (more aerodynamic)
        const noseGeometry = new THREE.ConeGeometry(0.7, 1.5, 12);
        const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
        nose.position.z = 3; // Position at the front of fuselage
        nose.rotation.z = Math.PI / 2;
        nose.castShadow = true;
        nose.receiveShadow = true;
        fuselageGroup.add(nose);

        // Cockpit canopy (glass)
        const cockpitGeometry = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const cockpit = new THREE.Mesh(cockpitGeometry, glassMaterial);
        cockpit.position.set(0, 0.5, 0.5); // On top of fuselage, slightly forward
        cockpit.castShadow = true;
        cockpit.receiveShadow = true;
        fuselageGroup.add(cockpit);

        // Main wings (more detailed)
        const wingGeometry = new THREE.BoxGeometry(8, 0.3, 2);
        const wings = new THREE.Mesh(wingGeometry, bodyMaterial);
        wings.position.set(0, 0, -0.5); // Slightly back on fuselage
        wings.castShadow = true;
        wings.receiveShadow = true;
        fuselageGroup.add(wings);

        // Wing tips
        const wingTipGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const leftWingTip = new THREE.Mesh(wingTipGeometry, accentMaterial);
        leftWingTip.position.set(-4, 0, -0.5);
        leftWingTip.castShadow = true;
        fuselageGroup.add(leftWingTip);

        const rightWingTip = new THREE.Mesh(wingTipGeometry, accentMaterial);
        rightWingTip.position.set(4, 0, -0.5);
        rightWingTip.castShadow = true;
        fuselageGroup.add(rightWingTip);

        // Engine nacelles
        const engineGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 12);
        const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        leftEngine.position.set(-2.5, 0, -1);
        leftEngine.rotation.z = Math.PI / 2;
        leftEngine.castShadow = true;
        leftEngine.receiveShadow = true;
        fuselageGroup.add(leftEngine);

        const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        rightEngine.position.set(2.5, 0, -1);
        rightEngine.rotation.z = Math.PI / 2;
        rightEngine.castShadow = true;
        rightEngine.receiveShadow = true;
        fuselageGroup.add(rightEngine);

        // Tail fin (vertical stabilizer) - wing-like shape
        const tailFinGeometry = new THREE.BoxGeometry(0.3, 2.5, 1.2);
        const tailFin = new THREE.Mesh(tailFinGeometry, bodyMaterial);
        tailFin.position.set(0, 1.2, -3); // On top of rear fuselage
        tailFin.castShadow = true;
        tailFin.receiveShadow = true;
        fuselageGroup.add(tailFin);

        // Horizontal stabilizers (elevator) - wing-like shape
        const stabilizerGeometry = new THREE.BoxGeometry(2.5, 0.15, 1);
        const horizontalStabilizer = new THREE.Mesh(stabilizerGeometry, bodyMaterial);
        horizontalStabilizer.position.set(0, 0.8, -3); // Below tail fin
        horizontalStabilizer.castShadow = true;
        horizontalStabilizer.receiveShadow = true;
        fuselageGroup.add(horizontalStabilizer);

        // Advanced propeller system (3-blade propeller)
        this.propellerGroup = new THREE.Group();
        
        // Propeller hub
        const propellerHubGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
        const propellerHub = new THREE.Mesh(propellerHubGeometry, propellerMaterial);
        propellerHub.position.set(0, 0, -3.5);
        this.propellerGroup.add(propellerHub);

        // Three propeller blades
        for (let i = 0; i < 3; i++) {
            const bladeGeometry = new THREE.BoxGeometry(0.05, 2.5, 0.2);
            const blade = new THREE.Mesh(bladeGeometry, propellerMaterial);
            blade.position.set(0, 0, -3.5);
            blade.rotation.z = (i * Math.PI * 2) / 3; // 120 degrees apart
            this.propellerGroup.add(blade);
        }
        
        fuselageGroup.add(this.propellerGroup);

        // Landing gear (retractable style)
        const strutMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });

        // Front landing gear
        const frontStrutGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
        const frontStrut = new THREE.Mesh(frontStrutGeometry, strutMaterial);
        frontStrut.position.set(0, -0.7, 1);
        frontStrut.castShadow = true;
        fuselageGroup.add(frontStrut);

        const frontWheelGeometry = new THREE.TorusGeometry(0.2, 0.1, 6, 12);
        const frontWheel = new THREE.Mesh(frontWheelGeometry, wheelMaterial);
        frontWheel.position.set(0, -1.2, 1);
        frontWheel.rotation.x = Math.PI / 2;
        frontWheel.castShadow = true;
        fuselageGroup.add(frontWheel);

        // Main landing gear
        const mainStrutGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
        const leftMainStrut = new THREE.Mesh(mainStrutGeometry, strutMaterial);
        leftMainStrut.position.set(-2, -0.7, -0.5);
        leftMainStrut.castShadow = true;
        fuselageGroup.add(leftMainStrut);

        const rightMainStrut = new THREE.Mesh(mainStrutGeometry, strutMaterial);
        rightMainStrut.position.set(2, -0.7, -0.5);
        rightMainStrut.castShadow = true;
        fuselageGroup.add(rightMainStrut);

        const mainWheelGeometry = new THREE.TorusGeometry(0.25, 0.1, 6, 12);
        const leftMainWheel = new THREE.Mesh(mainWheelGeometry, wheelMaterial);
        leftMainWheel.position.set(-2, -1.3, -0.5);
        leftMainWheel.rotation.x = Math.PI / 2;
        leftMainWheel.castShadow = true;
        fuselageGroup.add(leftMainWheel);

        const rightMainWheel = new THREE.Mesh(mainWheelGeometry, wheelMaterial);
        rightMainWheel.position.set(2, -1.3, -0.5);
        rightMainWheel.rotation.x = Math.PI / 2;
        rightMainWheel.castShadow = true;
        fuselageGroup.add(rightMainWheel);

        // Navigation lights removed - no more circles on screen edges

        // Add the main fuselage group to the airplane group
        this.airplane.add(fuselageGroup);

        // Position airplane in the scene
        this.airplane.position.set(0, 0, 0);
        this.scene.add(this.airplane);
    }

    createBoundaries() {
        // No boundaries - free flight mode
        // Airplane can fly anywhere in 3D space without restrictions
        this.boundaries = [];
    }

    createParticles() {
        // Engine trail particles
        this.createEngineTrails();
        
        // Environmental particles (dust, wind)
        this.createEnvironmentalParticles();
        
        // Explosion particles (for collisions)
        this.createExplosionParticles();
        
        // Legacy particle system for compatibility
        this.createLegacyParticles();
    }

    createEngineTrails() {
        this.engineTrails = [];
        
        for (let engine = 0; engine < 2; engine++) {
            const particleCount = 200;
            const geometry = new THREE.BufferGeometry();
            
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const sizes = new Float32Array(particleCount);
            const velocities = new Float32Array(particleCount * 3);
            const lifetimes = new Float32Array(particleCount);
            
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] = engine === 0 ? -2.5 : 2.5;
                positions[i * 3 + 1] = 0;
                positions[i * 3 + 2] = -1;
                
                colors[i * 3] = 1.0; // Red
                colors[i * 3 + 1] = 0.3 + Math.random() * 0.4; // Orange
                colors[i * 3 + 2] = 0.0; // No blue
                
                sizes[i] = 0.5 + Math.random() * 1.5;
                lifetimes[i] = 0;
                
                velocities[i * 3] = (Math.random() - 0.5) * 0.1;
                velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
                velocities[i * 3 + 2] = -0.5 - Math.random() * 0.5;
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
            geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
            
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 }
                },
                vertexShader: `
                    attribute float size;
                    attribute float lifetime;
                    varying vec3 vColor;
                    varying float vLifetime;
                    
                    void main() {
                        vColor = color;
                        vLifetime = lifetime;
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = size * (300.0 / -mvPosition.z) * (1.0 - lifetime);
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    varying vec3 vColor;
                    varying float vLifetime;
                    
                    void main() {
                        float alpha = 1.0 - vLifetime;
                        gl_FragColor = vec4(vColor, alpha);
                    }
                `,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                vertexColors: true
            });
            
            const particles = new THREE.Points(geometry, material);
            this.scene.add(particles);
            this.engineTrails.push({
                particles: particles,
                geometry: geometry,
                material: material,
                engineIndex: engine
            });
        }
    }

    createEnvironmentalParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 1] = Math.random() * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
            
            colors[i * 3] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
            
            sizes[i] = 0.1 + Math.random() * 0.5;
            lifetimes[i] = Math.random();
            
            velocities[i * 3] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 1] = -0.01 - Math.random() * 0.01;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute float size;
                attribute float lifetime;
                varying vec3 vColor;
                varying float vLifetime;
                
                void main() {
                    vColor = color;
                    vLifetime = lifetime;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z) * (0.3 + 0.7 * (1.0 - lifetime));
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vLifetime;
                
                void main() {
                    float alpha = (1.0 - vLifetime) * 0.3;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        
        this.environmentalParticles = new THREE.Points(geometry, material);
        this.scene.add(this.environmentalParticles);
    }

    createExplosionParticles() {
        this.explosionParticles = [];
        // This will be populated when explosions occur
    }

    createLegacyParticles() {
        // Keep the original particle system for compatibility
        this.particleCount = 1000;
        this.particleGeometry = new THREE.BufferGeometry();
        this.particlePositions = new Float32Array(this.particleCount * 3);
        this.particleOpacities = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            this.particlePositions[i * 3] = 0;
            this.particlePositions[i * 3 + 1] = 0;
            this.particlePositions[i * 3 + 2] = 0;
            this.particleOpacities[i] = 1.0;
        }

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
        this.particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(this.particleOpacities, 1));

        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x00ffff) }
            },
            vertexShader: `
                attribute float opacity;
                varying float vOpacity;
                void main() {
                    vOpacity = opacity;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 3.0;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                varying float vOpacity;
                void main() {
                    gl_FragColor = vec4(color, vOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        this.particleSystem = new THREE.Points(this.particleGeometry, particleMaterial);
        this.scene.add(this.particleSystem);

        // Particle velocities and lifetimes
        this.particleVelocities = [];
        this.particleLifetimes = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particleVelocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            ));
            this.particleLifetimes.push(Math.random() * 100 + 50);
        }
    }

    createObstacles() {
        // Pre-generate obstacles far ahead for better gameplay
        this.obstacles = [];
        
        // Generate obstacles in advance - create a "highway" of obstacles (BALANCED)
        for (let i = 0; i < 15; i++) {
            this.spawnNewObstacle();
        }
    }

    createCubeObstacle() {
        const geometry = new THREE.BoxGeometry(
            2 + Math.random() * 4,
            2 + Math.random() * 4,
            2 + Math.random() * 4
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
            transparent: true,
            opacity: 0.8,
            shininess: 30
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        // Add floating animation
        obstacle.userData = {
            floatSpeed: 0.01 + Math.random() * 0.02,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.005 + Math.random() * 0.01
        };

        return obstacle;
    }

    createSphereObstacle() {
        const geometry = new THREE.SphereGeometry(
            1.5 + Math.random() * 3,
            8 + Math.floor(Math.random() * 8),
            6 + Math.floor(Math.random() * 6)
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6),
            transparent: true,
            opacity: 0.7,
            shininess: 50
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        obstacle.userData = {
            floatSpeed: 0.015 + Math.random() * 0.025,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.01 + Math.random() * 0.02
        };

        return obstacle;
    }

    createCylinderObstacle() {
        const geometry = new THREE.CylinderGeometry(
            1 + Math.random() * 2,
            1 + Math.random() * 2,
            3 + Math.random() * 6,
            8 + Math.floor(Math.random() * 8)
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5),
            transparent: true,
            opacity: 0.8,
            shininess: 40
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        obstacle.userData = {
            floatSpeed: 0.008 + Math.random() * 0.015,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.007 + Math.random() * 0.015
        };

        return obstacle;
    }

    createRingObstacle() {
        const geometry = new THREE.TorusGeometry(
            2 + Math.random() * 3,
            0.5 + Math.random() * 1,
            6 + Math.floor(Math.random() * 6),
            8 + Math.floor(Math.random() * 8)
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6),
            transparent: true,
            opacity: 0.9,
            shininess: 60
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        obstacle.userData = {
            floatSpeed: 0.012 + Math.random() * 0.02,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.008 + Math.random() * 0.018
        };

        return obstacle;
    }

    createPyramidObstacle() {
        const geometry = new THREE.ConeGeometry(
            1.5 + Math.random() * 3,
            3 + Math.random() * 4,
            4 + Math.floor(Math.random() * 4)
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
            transparent: true,
            opacity: 0.8,
            shininess: 40
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        obstacle.userData = {
            floatSpeed: 0.012 + Math.random() * 0.02,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.008 + Math.random() * 0.015
        };

        return obstacle;
    }

    createDiamondObstacle() {
        const geometry = new THREE.OctahedronGeometry(
            1.5 + Math.random() * 2.5
        );
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6),
            transparent: true,
            opacity: 0.7,
            shininess: 60
        });

        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        obstacle.userData = {
            floatSpeed: 0.015 + Math.random() * 0.025,
            floatOffset: Math.random() * Math.PI * 2,
            rotationSpeed: 0.01 + Math.random() * 0.02
        };

        return obstacle;
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;

            // Start game on first key press
            if (!this.gameStarted && !this.gameOver) {
                this.startGame();
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        // Prevent right-click context menu from stealing focus
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // If window/tab loses focus, clear pressed keys to avoid stuck inputs
        window.addEventListener('blur', () => {
            this.keys = {};
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.keys = {};
            }
        });

        // Mouse controls for mobile
        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Touch controls for mobile
        document.addEventListener('touchmove', (event) => {
            event.preventDefault();
            if (event.touches.length > 0) {
                mouseX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                mouseY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
            }
        });
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        // Restart button
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restartGame();
        });
    }

    startGame() {
        // Enhanced start game with better initialization
        this.gameStarted = true;
        this.gameOver = false;
        this.score = 0;
        this.gameSpeed = 1.0;
        this.lastSpawnTime = Date.now();
        this.spawnInterval = 1500;
        this.multiSpawnCount = 2;
        this.gameStartTime = Date.now(); // Record when game started
        document.getElementById('start-screen').classList.add('hidden');
        this.clock.start();
        
        // Reset airplane speed to base speed
        this.airplaneSpeed = this.baseAirplaneSpeed;
        
        // Reset HUD
        document.getElementById('score').textContent = '0';
        document.getElementById('speed').textContent = '120';
        document.getElementById('altitude').textContent = '1000';
        document.getElementById('health-fill').style.width = '100%';
    }

    restartGame() {
        // Enhanced restart with better reset
        this.gameStarted = false;
        this.gameOver = false;
        this.score = 0;
        this.gameSpeed = 1.0;
        this.lastSpawnTime = Date.now();
        this.spawnInterval = 1500;
        this.multiSpawnCount = 2;
        this.gameStartTime = Date.now();
        
        // Reset airplane speed to base speed
        this.airplaneSpeed = this.baseAirplaneSpeed;
        this.airplane.position.set(0, 0, 0);
        this.airplane.rotation.set(0, 0, 0);
        
        // Reset camera
        this.camera.position.set(0, 8, 15);
        this.camera.lookAt(0, 0, -30);
        
        // Clear obstacles
        this.obstacles.forEach(obstacle => this.scene.remove(obstacle));
        this.obstacles = [];
        
        // Reset HUD
        document.getElementById('score').textContent = '0';
        document.getElementById('speed').textContent = '120';
        document.getElementById('altitude').textContent = '1000';
        document.getElementById('health-fill').style.width = '100%';
        
        // Hide game over screen
        document.getElementById('game-over').classList.add('hidden');
        
        // Show start screen
        document.getElementById('start-screen').classList.remove('hidden');
    }

    updateAirplane() {
        if (!this.gameStarted || this.gameOver) return;

        const deltaTime = this.clock.getDelta();

        // Enhanced rotation controls - speed-scaled for better dodging
        let pitch = 0, yaw = 0, roll = 0;
        
        // Scale control sensitivity with airplane speed for faster movement at higher speeds (slightly faster)
        const controlSensitivity = 0.035 + (this.airplaneSpeed - this.baseAirplaneSpeed) * 0.020;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) pitch = -controlSensitivity;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) pitch = controlSensitivity;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) yaw = controlSensitivity;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) yaw = -controlSensitivity;
        if (this.keys['KeyQ']) roll = controlSensitivity;
        if (this.keys['KeyE']) roll = -controlSensitivity;

        // Apply rotations with auto-leveling
        this.airplane.rotation.x += pitch;
        this.airplane.rotation.y += yaw;
        this.airplane.rotation.z += roll;

        // Speed-scaled auto-leveling - less aggressive at higher speeds for better control
        const autoLeveling = 0.92 - (this.airplaneSpeed - this.baseAirplaneSpeed) * 0.02; // Less auto-leveling at higher speeds
        this.airplane.rotation.x *= Math.max(0.88, autoLeveling);
        this.airplane.rotation.y *= Math.max(0.88, autoLeveling);
        this.airplane.rotation.z *= Math.max(0.88, autoLeveling);

        // Limit rotation angles - anti-spinning with 60 degree limits
        this.airplane.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.airplane.rotation.x)); // ±60° pitch
        this.airplane.rotation.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.airplane.rotation.y)); // ±60° yaw
        this.airplane.rotation.z = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.airplane.rotation.z)); // ±60° roll

        // Movement based on rotation - proper 3D movement
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(this.airplane.rotation);

        // Enhanced movement with speed-scaled multiplier for faster dodging at higher speeds (slightly faster)
        const movementMultiplier = 80 + (this.airplaneSpeed - this.baseAirplaneSpeed) * 60; // Scale movement with speed
        const movement = direction.multiplyScalar(this.airplaneSpeed * deltaTime * movementMultiplier);
        this.airplane.position.add(movement);

        // Clamp airplane altitude above sea level to create a barrier
        if (this.ocean) {
            const minAltitude = this.oceanBaseY + 8; // 8 units above sea
            if (this.airplane.position.y < minAltitude) {
                this.airplane.position.y = minAltitude;
            }
        }

        // Enhanced propeller animation - faster and more realistic
        if (this.propellerGroup) {
            this.propellerGroup.rotation.z += 1.2; // Faster propeller for more realistic effect
        }

        // Free flight - no boundary restrictions
        // Airplane can fly anywhere in 3D space without limits

        // Remove position restrictions - allow free flight
        // No position limits - airplane can fly freely in all directions

        // Enhanced camera system with smoother following
        const airplaneRotation = this.airplane.rotation;
        
        // Enhanced camera offset with better following
        const maxYawInfluence = Math.PI / 18; // 10 degrees in radians
        const limitedYaw = Math.max(-maxYawInfluence, Math.min(maxYawInfluence, airplaneRotation.y));
        
        const cameraOffsetX = Math.sin(limitedYaw) * 8; // Better horizontal following
        const cameraOffsetY = 12; // Higher camera position for better view
        const cameraOffsetZ = 20; // Further back for better perspective
        
        // Enhanced camera position behind airplane
        const baseCameraX = this.airplane.position.x - cameraOffsetX;
        const baseCameraY = this.airplane.position.y + cameraOffsetY;
        const baseCameraZ = this.airplane.position.z + cameraOffsetZ;

        // Smoother camera movement
        this.camera.position.x += (baseCameraX - this.camera.position.x) * 0.08;
        this.camera.position.y += (baseCameraY - this.camera.position.y) * 0.08;
        this.camera.position.z += (baseCameraZ - this.camera.position.z) * 0.08;

        // Enhanced look-at point
        const lookAtX = this.airplane.position.x + Math.sin(limitedYaw) * 5;
        const lookAtY = this.airplane.position.y + 2;
        const lookAtZ = this.airplane.position.z - 30;

        const lookAt = new THREE.Vector3(lookAtX, lookAtY, lookAtZ);
        this.camera.lookAt(lookAt);

        // Update engine lights to follow airplane
        if (this.engineLights) {
            this.engineLights.forEach((light, index) => {
                light.position.x = this.airplane.position.x + (index === 0 ? -2.5 : 2.5);
                light.position.y = this.airplane.position.y;
                light.position.z = this.airplane.position.z - 1;
            });
        }
    }

    updateObstacles() {
        if (!this.gameStarted || this.gameOver) return;

        const deltaTime = this.clock.getDelta();
        const currentTime = Date.now();

        // Check if enough time has passed since game start
        const timeSinceStart = currentTime - this.gameStartTime;
        if (timeSinceStart < this.gameStartDelay) {
            return; // Don't spawn obstacles yet
        }

        // More frequent spawning with edge coverage - prevent camping
        if (currentTime - this.lastSpawnTime > this.spawnInterval) {
            // Spawn multiple obstacles for more challenge
            for (let i = 0; i < this.multiSpawnCount; i++) {
                this.spawnNewObstacle();
            }
            this.lastSpawnTime = currentTime;

        // Enhanced multi-spawn scaling - KEEP CONSTANT
        // No more increasing multi-spawn count - keep at 2
        // if (this.score > 20 && this.multiSpawnCount < 2) {
        //     this.multiSpawnCount = 2;
        // }
        // if (this.score > 50 && this.multiSpawnCount < 3) {
        //     this.multiSpawnCount = 3;
        // }
        // if (this.score > 100 && this.multiSpawnCount < 4) {
        //     this.multiSpawnCount = 4;
        // }
        }

        // Enhanced edge spawning for more challenging gameplay - BALANCED FREQUENCY
        if (currentTime - this.lastSpawnTime > this.spawnInterval * 1.2) { // Spawn edge obstacles at balanced frequency
            this.spawnEdgeObstacle();
        }

        this.obstacles.forEach((obstacle, index) => {
        // Enhanced obstacle movement with better speed scaling - SLOWER
        obstacle.position.z += this.gameSpeed * 1.2; // Slower obstacle movement

            // Enhanced floating animation with better effects
            if (obstacle.userData) {
                obstacle.position.y += Math.sin(Date.now() * obstacle.userData.floatSpeed + obstacle.userData.floatOffset) * 0.02; // More pronounced floating
                obstacle.rotation.x += obstacle.userData.rotationSpeed * 1.5; // Faster rotation
                obstacle.rotation.y += obstacle.userData.rotationSpeed * 0.8;
                obstacle.rotation.z += obstacle.userData.rotationSpeed * 0.6;
            }

            // Enhanced obstacle reset with better positioning
            if (obstacle.position.z > 20) {
                this.resetObstacle(obstacle);

                // Increase score only once per obstacle
                if (!obstacle.userData.scored) {
                    this.score++;
                    this.updateScore();
                    obstacle.userData.scored = true; // Mark as scored to prevent double counting
                }

                // Enhanced difficulty scaling for more challenging gameplay
                if (this.score % 10 === 0) {
                    this.gameSpeed += 0.01; // Slower speed increase
                    // Keep spawn interval constant - no more increasing difficulty
                    // this.spawnInterval = Math.max(1500, this.spawnInterval - 50); // REMOVED

                    // Keep obstacle count constant - no more increasing difficulty
                    // if (this.obstacleCount < 20) {
                    //     this.obstacleCount += 1;
                    // }
                }
            }
        });
    }

    spawnNewObstacle() {
        const obstacleTypes = [
            this.createCubeObstacle,
            this.createSphereObstacle,
            this.createCylinderObstacle,
            this.createRingObstacle,
            this.createPyramidObstacle,
            this.createDiamondObstacle
        ];

        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const obstacle = type.call(this);

        // Enhanced obstacle spawning with better positioning - MUCH FARTHER AHEAD
        const airplaneZ = this.airplane.position.z;
        const airplaneY = this.airplane.position.y;
        const airplaneX = this.airplane.position.x;
        
        const baseDistance = 300; // MUCH farther distance for early preparation
        const randomOffset = Math.random() * 100; // Up to 100 units ahead
        const spawnDistance = baseDistance + randomOffset;

        // Enhanced positioning with full coverage - more challenging
        obstacle.position.x = airplaneX + (Math.random() - 0.5) * 80; // Wider width spread
        obstacle.position.y = airplaneY + (Math.random() - 0.5) * 60; // Wider height spread
        obstacle.position.z = airplaneZ - spawnDistance; // Always MUCH farther ahead of airplane

        // Enhanced rotation with more variety for visual interest
        obstacle.rotation.x = Math.random() * Math.PI * 2;
        obstacle.rotation.y = Math.random() * Math.PI * 2;
        obstacle.rotation.z = Math.random() * Math.PI * 2;
        
        // Enhanced obstacle initialization with better scoring
        obstacle.userData.scored = false;

        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
    }

    resetObstacle(obstacle) {
        // Enhanced obstacle reset with better positioning - MUCH FARTHER AHEAD
        const airplaneZ = this.airplane.position.z;
        const airplaneY = this.airplane.position.y;
        const airplaneX = this.airplane.position.x;
        
        const baseDistance = 300; // MUCH farther distance for early preparation
        const randomOffset = Math.random() * 100; // Up to 100 units ahead
        const spawnDistance = baseDistance + randomOffset;

        // Enhanced positioning with full coverage - no safe zones
        obstacle.position.x = airplaneX + (Math.random() - 0.5) * 80; // Full width spread to prevent edge camping
        obstacle.position.y = airplaneY + (Math.random() - 0.5) * 60; // Full height spread to prevent edge camping
        obstacle.position.z = airplaneZ - spawnDistance; // Always MUCH farther ahead of airplane

        // Enhanced rotation with more variety
        obstacle.rotation.x = Math.random() * Math.PI * 2;
        obstacle.rotation.y = Math.random() * Math.PI * 2;
        obstacle.rotation.z = Math.random() * Math.PI * 2;
        
        // Enhanced obstacle reset with better scoring
        obstacle.userData.scored = false;
    }

    spawnEdgeObstacle() {
        // Enhanced edge obstacle spawning for more challenging gameplay
        const obstacleTypes = [
            this.createCubeObstacle,
            this.createSphereObstacle,
            this.createCylinderObstacle,
            this.createRingObstacle,
            this.createPyramidObstacle,
            this.createDiamondObstacle
        ];

        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const obstacle = type.call(this);

        const airplaneZ = this.airplane.position.z;
        const airplaneY = this.airplane.position.y;
        const airplaneX = this.airplane.position.x;
        
        const baseDistance = 300; // MUCH farther distance for early preparation
        const randomOffset = Math.random() * 100; // Up to 100 units ahead
        const spawnDistance = baseDistance + randomOffset;

        // Enhanced edge positioning with better coverage
        const edgeType = Math.floor(Math.random() * 4);
        switch(edgeType) {
            case 0: // Left edge
                obstacle.position.x = airplaneX - 35; // Far left
                obstacle.position.y = airplaneY + (Math.random() - 0.5) * 20;
                break;
            case 1: // Right edge
                obstacle.position.x = airplaneX + 35; // Far right
                obstacle.position.y = airplaneY + (Math.random() - 0.5) * 20;
                break;
            case 2: // Top edge
                obstacle.position.x = airplaneX + (Math.random() - 0.5) * 20;
                obstacle.position.y = airplaneY + 25; // Far top
                break;
            case 3: // Bottom edge
                obstacle.position.x = airplaneX + (Math.random() - 0.5) * 20;
                obstacle.position.y = airplaneY - 25; // Far bottom
                break;
        }
        
        obstacle.position.z = airplaneZ - spawnDistance;
        
        // Enhanced obstacle initialization with better scoring
        obstacle.userData.scored = false;

        this.obstacles.push(obstacle);
        this.scene.add(obstacle);
    }

    updateParticles() {
        if (!this.gameStarted || this.gameOver) return;

        // Update engine trail particles
        this.updateEngineTrails();
        
        // Update environmental particles
        this.updateEnvironmentalParticles();
        
        // Update legacy particles
        this.updateLegacyParticles();
    }

    updateEngineTrails() {
        this.engineTrails.forEach(trail => {
            const positions = trail.geometry.attributes.position.array;
            const velocities = trail.geometry.attributes.velocity.array;
            const lifetimes = trail.geometry.attributes.lifetime.array;
            
            for (let i = 0; i < positions.length / 3; i++) {
                // Update particle position
                positions[i * 3] += velocities[i * 3];
                positions[i * 3 + 1] += velocities[i * 3 + 1];
                positions[i * 3 + 2] += velocities[i * 3 + 2];
                
                // Update lifetime
                lifetimes[i] += 0.02;
                
                // Reset particles that have lived too long
                if (lifetimes[i] > 1.0) {
                    positions[i * 3] = trail.engineIndex === 0 ? -2.5 : 2.5;
                    positions[i * 3 + 1] = 0;
                    positions[i * 3 + 2] = -1;
                    lifetimes[i] = 0;
                    
                    velocities[i * 3] = (Math.random() - 0.5) * 0.1;
                    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
                    velocities[i * 3 + 2] = -0.5 - Math.random() * 0.5;
                }
            }
            
            trail.geometry.attributes.position.needsUpdate = true;
            trail.geometry.attributes.lifetime.needsUpdate = true;
        });
    }

    updateEnvironmentalParticles() {
        if (!this.environmentalParticles) return;
        
        const positions = this.environmentalParticles.geometry.attributes.position.array;
        const velocities = this.environmentalParticles.geometry.attributes.velocity.array;
        const lifetimes = this.environmentalParticles.geometry.attributes.lifetime.array;
        
        for (let i = 0; i < positions.length / 3; i++) {
            // Update particle position
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];
            
            // Update lifetime
            lifetimes[i] += 0.001;
            
            // Reset particles that have lived too long
            if (lifetimes[i] > 1.0) {
                positions[i * 3] = (Math.random() - 0.5) * 1000;
                positions[i * 3 + 1] = Math.random() * 200;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
                lifetimes[i] = 0;
                
                velocities[i * 3] = (Math.random() - 0.5) * 0.02;
                velocities[i * 3 + 1] = -0.01 - Math.random() * 0.01;
                velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
            }
        }
        
        this.environmentalParticles.geometry.attributes.position.needsUpdate = true;
        this.environmentalParticles.geometry.attributes.lifetime.needsUpdate = true;
    }

    updateLegacyParticles() {
        // Update particle positions to create trail effect behind airplane
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Move particles backward relative to airplane movement
            this.particlePositions[i3] -= 0.2; // Move backward in Z
            this.particlePositions[i3 + 1] += this.particleVelocities[i].y;
            this.particlePositions[i3 + 2] += this.particleVelocities[i].z;

            // Add some randomness
            this.particlePositions[i3 + 1] += (Math.random() - 0.5) * 0.02;
            this.particlePositions[i3 + 2] += (Math.random() - 0.5) * 0.02;

            // Decrease lifetime
            this.particleLifetimes[i]--;

            // Reset particle when lifetime expires
            if (this.particleLifetimes[i] <= 0) {
                this.particlePositions[i3] = this.airplane.position.x + (Math.random() - 0.5) * 2;
                this.particlePositions[i3 + 1] = this.airplane.position.y + (Math.random() - 0.5) * 2;
                this.particlePositions[i3 + 2] = this.airplane.position.z + 5;
                this.particleLifetimes[i] = Math.random() * 100 + 50;
                this.particleOpacities[i] = 1.0; // Reset opacity
            }

            // Fade out particles as they get older
            const age = (100 - this.particleLifetimes[i]) / 100;
            this.particleOpacities[i] = Math.max(0, 1 - age * age);
        }

        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.opacity.needsUpdate = true;
    }

    checkCollisions() {
        if (!this.gameStarted || this.gameOver) return;

        const airplaneBox = new THREE.Box3().setFromObject(this.airplane);

        for (let obstacle of this.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);

            if (airplaneBox.intersectsBox(obstacleBox)) {
                this.endGame();
                break;
            }
        }
    }

    endGame() {
        // Enhanced game over screen with more stats
        this.gameOver = true;
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('distance').textContent = Math.round(this.score * 0.5);
        document.getElementById('obstacles-avoided').textContent = this.score;
        document.getElementById('max-speed').textContent = Math.round(120 + this.gameSpeed * 50);
        document.getElementById('game-over').classList.remove('hidden');
    }

    updateScore() {
        this.score++;
        document.getElementById('score').textContent = this.score;
        
        // Increase airplane speed every 1000 points
        if (this.score % 1000 === 0) {
            this.airplaneSpeed = this.baseAirplaneSpeed + (this.score / 1000) * 1;
            console.log(`Speed increased! New speed: ${this.airplaneSpeed.toFixed(2)}`);
        }
        
        // Update HUD elements
        this.updateHUD();
    }

    updateHUD() {
        // Update speedometer
        const speed = Math.round(120 + this.gameSpeed * 50);
        document.getElementById('speed').textContent = speed;
        
        // Update altimeter
        const altitude = Math.round(1000 + this.airplane.position.y * 10);
        document.getElementById('altitude').textContent = altitude;
        
        // Update health bar (decreases over time)
        const healthPercent = Math.max(0, 100 - (this.score * 0.5));
        document.getElementById('health-fill').style.width = healthPercent + '%';
        
        // Update radar
        this.updateRadar();
    }

    updateRadar() {
        const canvas = document.getElementById('radar-canvas');
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 30; // Smaller radius for smaller canvas
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw radar background
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw radar lines
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        
        // Draw obstacles on radar
        ctx.fillStyle = '#ff0000';
        this.obstacles.forEach(obstacle => {
            const dx = obstacle.position.x - this.airplane.position.x;
            const dz = obstacle.position.z - this.airplane.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 100) { // Only show nearby obstacles
                const angle = Math.atan2(dx, dz);
                const radarX = centerX + Math.sin(angle) * (distance / 100) * radius;
                const radarY = centerY + Math.cos(angle) * (distance / 100) * radius;
                
                ctx.beginPath();
                ctx.arc(radarX, radarY, 2, 0, Math.PI * 2); // Smaller obstacle dots
                ctx.fill();
            }
        });
        
        // Draw airplane position (center)
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 1.5, 0, Math.PI * 2); // Smaller airplane dot
        ctx.fill();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.updateAirplane();
        this.updateObstacles();
        this.updateParticles();
        this.updateClouds();
        this.updateOcean(); // Update ocean animation
        this.updateHUD(); // Update HUD every frame
        this.checkCollisions();

        this.renderer.render(this.scene, this.camera);
    }

    updateClouds() {
        if (!this.gameStarted || this.gameOver) return;

        this.clouds.forEach(cloud => {
            cloud.position.z += this.gameSpeed * 0.3; // Clouds move slower than obstacles

            // If cloud passes player, reset its position
            if (cloud.position.z > this.airplane.position.z + 20) {
                cloud.position.z = this.airplane.position.z - 400 - Math.random() * 200;
                cloud.position.x = this.airplane.position.x + (Math.random() - 0.5) * 400;
                cloud.position.y = 50 + Math.random() * 100;
            }
        });
    }
    
    updateOcean() {
        if (!this.ocean) return;
        
        // Update ocean wave animation for all tiles
        const time = Date.now() * 0.001;
        this.oceanTiles.forEach(tile => {
            if (tile.material && tile.material.uniforms && tile.material.uniforms.time) {
                tile.material.uniforms.time.value = time;
            }
        });
        
        // Generate new ocean tiles around airplane
        const airplaneX = this.airplane.position.x;
        const airplaneZ = this.airplane.position.z;
        const tileSize = this.oceanTileSize;
        
        // Calculate which tiles should exist around the airplane
        const centerTileX = Math.round(airplaneX / tileSize) * tileSize;
        const centerTileZ = Math.round(airplaneZ / tileSize) * tileSize;
        
        // Generate tiles in a 3x3 grid around the airplane
        for (let x = centerTileX - tileSize; x <= centerTileX + tileSize; x += tileSize) {
            for (let z = centerTileZ - tileSize; z <= centerTileZ + tileSize; z += tileSize) {
                // Check if tile already exists
                const tileExists = this.oceanTiles.some(tile => 
                    tile.userData.tileX === x && tile.userData.tileZ === z
                );
                
                if (!tileExists) {
                    this.createOceanTile(x, z);
                }
            }
        }
        
        // Clean up distant tiles
        this.oceanTiles = this.oceanTiles.filter(tile => {
            const distance = Math.sqrt(
                Math.pow(tile.userData.tileX - airplaneX, 2) + 
                Math.pow(tile.userData.tileZ - airplaneZ, 2)
            );
            
            if (distance > this.oceanCleanupDistance) {
                this.scene.remove(tile);
                return false;
            }
            return true;
        });
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new AirplaneDodgeGame();
});
