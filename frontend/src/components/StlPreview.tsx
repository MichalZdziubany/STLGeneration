"use client";

import { useEffect, useRef } from "react";

type StlPreviewProps = {
  url: string;
};

export default function StlPreview({ url }: StlPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let animationFrame = 0;
    let renderer: any = null;
    let controls: any = null;
    let geometry: any = null;
    let material: any = null;
    let resizeObserver: ResizeObserver | null = null;

    const setup = async () => {
      const mount = mountRef.current;
      if (!mount || !mounted) return;

      const THREE = await import("three");
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (!mounted || !mountRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf5f5f5);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      camera.position.set(120, 120, 120);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(120, 120, 180);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      const fit = () => {
        if (!mount) return;
        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      fit();

      const loader = new STLLoader();
      loader.load(
        url,
        (loaded: any) => {
          if (!mounted) return;

          geometry = loaded;
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          geometry.center();

          material = new THREE.MeshStandardMaterial({
            color: 0x3b82f6,
            metalness: 0.15,
            roughness: 0.55,
          });

          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);

          const bounds = geometry.boundingBox;
          if (bounds) {
            const size = bounds.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 1);
            const distance = maxDim * 2.3;
            camera.position.set(distance, distance, distance);
            camera.near = Math.max(maxDim / 100, 0.1);
            camera.far = maxDim * 100;
            camera.updateProjectionMatrix();
          }

          controls.update();
        },
        undefined,
        (error: unknown) => {
          console.error("Failed to load STL preview", error);
        }
      );

      const animate = () => {
        if (!mounted) return;
        controls.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(animate);
      };
      animate();

      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(mount);
    };

    setup();

    return () => {
      mounted = false;
      window.cancelAnimationFrame(animationFrame);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (controls) {
        controls.dispose();
      }
      if (geometry) {
        geometry.dispose();
      }
      if (material) {
        material.dispose();
      }
      if (renderer) {
        renderer.dispose();
        const domElement = renderer.domElement as HTMLCanvasElement | undefined;
        if (domElement && domElement.parentElement) {
          domElement.parentElement.removeChild(domElement);
        }
      }
    };
  }, [url]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
