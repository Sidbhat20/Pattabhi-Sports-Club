import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Plain three.js on a WebGL canvas. It runs only while the loading screen is shown.
export default function Basketball3D() {
  const mount = useRef(null);

  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.2;
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(3, 4, 5);
    scene.add(light);

    // Orange ball with club-maroon seams.
    const ball = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xec7c1c, roughness: 0.6 });
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x9c242c });
    const seamGeo = new THREE.TorusGeometry(1.001, 0.025, 12, 96);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), skin));
    [[0, 0, 0], [0, Math.PI / 2, 0], [Math.PI / 2, 0, 0]].forEach(([x, y, z]) => {
      const seam = new THREE.Mesh(seamGeo, seamMat);
      seam.rotation.set(x, y, z);
      ball.add(seam);
    });
    ball.rotation.set(0.3, 0, 0.2);
    scene.add(ball);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    let frame;
    let last = performance.now();
    const tick = (now) => {
      ball.rotation.y += ((now - last) / 1000) * 0.8;
      last = now;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => o.geometry?.dispose());
      skin.dispose();
      seamMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mount} className="loader-3d" />;
}
