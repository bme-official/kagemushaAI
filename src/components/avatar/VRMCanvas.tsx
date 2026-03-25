"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { AvatarBehaviorState } from "@/types/avatar";

type VRMCanvasProps = {
  modelUrl: string;
  behavior: AvatarBehaviorState;
};

export const VRMCanvas = ({ modelUrl, behavior }: VRMCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const behaviorRef = useRef<AvatarBehaviorState>(behavior);
  const currentVrmRef = useRef<VRM | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    behaviorRef.current = behavior;
  }, [behavior]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 1000);
    camera.position.set(0, 1.4, 3.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 1);
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);

    const clock = new THREE.Clock();
    let animationFrameId = 0;

    const applyBoneRotation = (
      bone: THREE.Object3D | null | undefined,
      target: Partial<Record<"x" | "y" | "z", number>>
    ) => {
      if (!bone) return;
      if (typeof target.x === "number") {
        bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, target.x, 0.12);
      }
      if (typeof target.y === "number") {
        bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, target.y, 0.12);
      }
      if (typeof target.z === "number") {
        bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, target.z, 0.12);
      }
    };

    const applyExpression = (vrm: VRM, elapsedSec: number) => {
      const expressionManager = vrm.expressionManager;
      if (!expressionManager) return;

      expressionManager.setValue("happy", 0);
      expressionManager.setValue("angry", 0);
      expressionManager.setValue("surprised", 0);
      expressionManager.setValue("relaxed", 0);
      expressionManager.setValue("aa", 0);
      expressionManager.setValue("ih", 0);
      expressionManager.setValue("ou", 0);

      const nextBehavior = behaviorRef.current;
      switch (nextBehavior.expression) {
        case "smile":
          expressionManager.setValue("happy", 0.6);
          break;
        case "serious":
          expressionManager.setValue("angry", 0.25);
          break;
        case "surprised":
          expressionManager.setValue("surprised", 0.55);
          break;
        case "thinking":
          expressionManager.setValue("relaxed", 0.35);
          break;
        default:
          break;
      }

      if (nextBehavior.voice === "speaking") {
        const mouth = 0.12 + (Math.sin(elapsedSec * 14) + 1) * 0.15;
        expressionManager.setValue("aa", mouth);
        expressionManager.setValue("ih", mouth * 0.45);
        expressionManager.setValue("ou", mouth * 0.4);
      }
    };

    const applyGesture = (vrm: VRM, elapsedSec: number) => {
      const head = vrm.humanoid.getNormalizedBoneNode("head");
      const neck = vrm.humanoid.getNormalizedBoneNode("neck");
      const spine = vrm.humanoid.getNormalizedBoneNode("spine");
      const leftUpperArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
      const rightUpperArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
      const nextBehavior = behaviorRef.current;
      const idleSwing = Math.sin(elapsedSec * 1.5) * 0.05;

      applyBoneRotation(head, { x: idleSwing * 0.4, y: idleSwing * 0.6, z: 0 });
      applyBoneRotation(neck, { x: 0, y: idleSwing * 0.3, z: 0 });
      applyBoneRotation(spine, { x: 0, y: 0, z: 0 });
      applyBoneRotation(leftUpperArm, { x: 0.06, z: 0.05 });
      applyBoneRotation(rightUpperArm, { x: 0.06, z: -0.05 });

      switch (nextBehavior.gesture) {
        case "thinking":
          applyBoneRotation(head, { x: 0.2, y: -0.2 });
          applyBoneRotation(neck, { x: 0.1, y: -0.12 });
          break;
        case "listening":
          applyBoneRotation(head, { x: 0.05, y: 0.22 });
          applyBoneRotation(neck, { y: 0.14 });
          applyBoneRotation(spine, { y: 0.1 });
          break;
        case "explaining":
          applyBoneRotation(head, { x: -0.03, y: -0.1 });
          applyBoneRotation(leftUpperArm, { x: -0.2, z: 0.5 });
          applyBoneRotation(rightUpperArm, { x: -0.2, z: -0.5 });
          break;
        case "emphasis":
          applyBoneRotation(head, { x: -0.06, y: 0.08 });
          applyBoneRotation(neck, { x: -0.04 });
          applyBoneRotation(leftUpperArm, { x: -0.35, z: 0.85 });
          applyBoneRotation(rightUpperArm, { x: -0.35, z: -0.85 });
          break;
        default:
          break;
      }
    };

    const resize = () => {
      const width = container.clientWidth || 200;
      const height = container.clientHeight || 300;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      const delta = clock.getDelta();
      const currentVrm = currentVrmRef.current;
      if (currentVrm) {
        currentVrm.update(delta);
        applyExpression(currentVrm, clock.elapsedTime);
        applyGesture(currentVrm, clock.elapsedTime);
      }
      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      modelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);
        currentVrmRef.current = vrm;
        setError(null);
      },
      undefined,
      () => {
        setError("VRMモデルの読み込みに失敗しました。");
      }
    );

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      const currentVrm = currentVrmRef.current;
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
        currentVrmRef.current = null;
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 240, position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", borderRadius: 8 }} />
      {error ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.86)",
            color: "#b91c1c",
            fontSize: 13,
            textAlign: "center",
            padding: 12
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
};
