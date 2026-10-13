import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage/HomePage.jsx';
import AuthForm from './components/Auth/AuthForm.jsx';
import OperatorConsole from './components/Operator/OperatorConsole.jsx';
import FieldConsole from './components/Field/FieldConsole.jsx';
import AdminConsole from './components/Admin/AdminConsole.jsx';
import Analytics from './components/Analytics/Analytics.jsx';
import RoleHome from './components/Shared/RoleHome.jsx';
import RequireAuth from './RequireAuth.jsx';
import CitizenReport from './components/Citizen/CitizenReport.jsx';
import * as THREE from 'three';

export default function App() {
  // Add 3D background effect at body level (consistent with original ambient glow)
  useEffect(() => {
    // Create canvas element for Three.js
    const canvas = document.createElement('canvas');
    canvas.className = 'threejs-background-body';
    // Insert at beginning of body to ensure it's behind React content
    document.body.insertBefore(canvas, document.body.firstChild);

    // Initialize Three.js scene
    let renderer = null;
    let scene = null;
    let camera = null;
    let animationFrameId = null;

    try {
      // Create scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a); // Match --bg-dark

      // Create camera
      camera = new THREE.PerspectiveCamera(
        75,
        canvas.clientWidth / canvas.clientHeight || 1,
        0.1,
        1000
      );
      camera.position.z = 20;

      // Create renderer
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
      });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Add ambient light to complement existing glow effects
      const ambientLight = new THREE.AmbientLight(0xc0c0c0, 0.3); // --neon-silver
      scene.add(ambientLight);

      // Add directional light for subtle highlights
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Add another directional light from opposite side for balance
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
      directionalLight2.position.set(-5, -5, -5);
      scene.add(directionalLight2);

      // Create a sophisticated low-poly cityscape concept
      // Using hexagonal prism shapes to reference the H3 hexagonal grid system

      // Create a group for our cityscape
      const cityscape = new THREE.Group();
      scene.add(cityscape);

      // Create hexagonal prism geometry
      const createHexagonalPrism = (radius, height, color, emissiveIntensity = 0) => {
        // Approximate hexagonal prism using a cylinder with 6 segments
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 6, 1, false);
        const material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: new THREE.Color(color),
          emissiveIntensity: emissiveIntensity,
          metalness: 0.8,
          roughness: 0.2,
          transparent: true,
          opacity: 0.8
        });
        const prism = new THREE.Mesh(geometry, material);
        return prism;
      };

      // Create a series of hexagonal towers representing city infrastructure
      const towers = [];
      const numTowers = 8;

      for (let i = 0; i < numTowers; i++) {
        // Vary the parameters for a more organic cityscape
        const radius = 0.8 + Math.random() * 0.5;
        const height = 2 + Math.random() * 4;
        const x = (i - numTowers/2) * 3;
        const z = (Math.sin(i * 0.5) * 2) + (Math.cos(i * 0.3) * 1.5);

        // Use primary and accent colors for the towers
        const color = i % 2 === 0
          ? new THREE.Color(0x1d4ed8) // --primary
          : new THREE.Color(0xf97316); // --accent

        const tower = createHexagonalPrism(radius, height, color, 0.2);
        tower.position.set(x, height/2, z);

        // Add slight rotation to each tower for variety
        tower.rotation.y = Math.random() * Math.PI * 2;

        cityscape.add(tower);
        towers.push(tower);
      }

      // Create a floating hexagonal grid reference (subtle)
      const hexGridSize = 15;
      const hexGrid = new THREE.Group();

      for (let x = -hexGridSize; x <= hexGridSize; x += 2) {
        for (let z = -hexGridSize; z <= hexGridSize; z += 2) {
          if (Math.random() > 0.7) { // Only place some hexagons for subtlety
            const hexGeometry = new THREE.CircleGeometry(0.4, 6);
            const hexMaterial = new THREE.MeshBasicMaterial({
              color: 0xc0c0c0, // --neon-silver
              transparent: true,
              opacity: 0.1,
              side: THREE.DoubleSide
            });
            const hex = new THREE.Mesh(hexGeometry, hexMaterial);
            hex.position.set(x, 0.01, z); // Slightly above ground to avoid z-fighting
            hex.rotation.x = -Math.PI / 2; // Lay flat
            hexGrid.add(hex);
          }
        }
      }

      scene.add(hexGrid);

      // Add floating particles to represent data points/H3 cells
      const particlesCount = 50;
      const particlesGeometry = new THREE.BufferGeometry();
      const particlesPositions = new Float32Array(particlesCount * 3);

      for (let i = 0; i < particlesCount; i++) {
        particlesPositions[i * 3] = (Math.random() - 0.5) * 20;
        particlesPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        particlesPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }

      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));

      const particlesMaterial = new THREE.PointsMaterial({
        color: 0x10b981, // --success color for data points
        size: 0.1,
        transparent: true,
        opacity: 0.6
      });

      const particles = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particles);

      // Position camera
      camera.position.set(0, 5, 15);

      // Animation variables
      let time = 0;

      // Animation loop
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Slow rotation of the cityscape
        cityscape.rotation.y += 0.001;

        // Slow floating animation for particles
        const particlesArray = particles.geometry.attributes.position.array;
        for (let i = 0; i < particlesCount; i++) {
          particlesArray[i * 3 + 1] = Math.sin(time + i) * 0.5 + (Math.random() - 0.5) * 2;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Gentle pulsing of tower emissive values
        towers.forEach((tower, index) => {
          const offset = index * 0.5;
          tower.material.emissiveIntensity = 0.2 + Math.sin(time * 0.3 + offset) * 0.1;
        });

        renderer.render(scene, camera);
      };

      // Start animation
      animate();

      // Handle window resize
      const handleResize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      // Return cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);

        // Dispose of geometries and materials
        if (scene) {
          scene.traverse((object) => {
            if (object.isMesh) {
              if (object.geometry) object.geometry.dispose();
              if (object.material) object.material.dispose();
            }
            if (object.isPoints) {
              if (object.geometry) object.geometry.dispose();
              if (object.material) object.material.dispose();
            }
          });
        }

        // Dispose of renderer
        if (renderer) {
          renderer.dispose();
        }

        // Remove canvas from DOM
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        // Cleanup references
        canvas.remove();
        renderer = null;
        scene = null;
        camera = null;
      };
    } catch (error) {
      console.error('Failed to initialize Three.js background:', error);
      // Clean up if initialization failed
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      return () => {
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      };
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/signup" element={<AuthForm mode="signup" />} />
      <Route path="/citizen-report" element={<CitizenReport />} />
      <Route path="/role-home" element={<RequireAuth><RoleHome /></RequireAuth>} />
      <Route path="/operator" element={<RequireAuth roles={['operator']}><OperatorConsole /></RequireAuth>} />
      <Route path="/field" element={<RequireAuth roles={['field']}><FieldConsole /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminConsole /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth roles={['operator', 'admin']}><Analytics /></RequireAuth>} />
    </Routes>
  );
}
