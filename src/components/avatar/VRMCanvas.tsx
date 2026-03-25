"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { AvatarBehaviorState } from "@/types/avatar";

type VRMCanvasProps = {
  modelUrl: string;
  behavior: AvatarBehaviorState;
  onModelReady?: () => void;
};

export const VRMCanvas = ({ modelUrl, behavior, onModelReady }: VRMCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const behaviorRef = useRef<AvatarBehaviorState>(behavior);
  const onModelReadyRef = useRef<typeof onModelReady>(onModelReady);
  const currentVrmRef = useRef<VRM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);

  useEffect(() => {
    behaviorRef.current = behavior;
  }, [behavior]);

  useEffect(() => {
    onModelReadyRef.current = onModelReady;
  }, [onModelReady]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 1000);
    camera.position.set(0, 1.52, 1.28);
    camera.lookAt(0, 1.45, 0);

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

      if (nextBehavior.lipSyncActive) {
        const speed = nextBehavior.voice === "speaking" ? 16 : 11;
        const base = nextBehavior.voice === "speaking" ? 0.1 : 0.06;
        const amp = nextBehavior.voice === "speaking" ? 0.17 : 0.11;
        const mouth = base + (Math.sin(elapsedSec * speed) + 1) * amp;
        expressionManager.setValue("aa", mouth);
        expressionManager.setValue("ih", mouth * 0.45);
        expressionManager.setValue("ou", mouth * 0.4);
      }
      if (nextBehavior.voice === "listening") {
        expressionManager.setValue("relaxed", 0.2);
      }
    };

    const applyGesture = (vrm: VRM, elapsedSec: number) => {
      const head = vrm.humanoid.getNormalizedBoneNode("head");
      const neck = vrm.humanoid.getNormalizedBoneNode("neck");
      const spine = vrm.humanoid.getNormalizedBoneNode("spine");
      const upperChest = vrm.humanoid.getNormalizedBoneNode("upperChest");
      const leftShoulder = vrm.humanoid.getNormalizedBoneNode("leftShoulder");
      const rightShoulder = vrm.humanoid.getNormalizedBoneNode("rightShoulder");
      const leftUpperArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
      const rightUpperArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
      const leftLowerArm = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
      const rightLowerArm = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");
      const leftHand = vrm.humanoid.getNormalizedBoneNode("leftHand");
      const rightHand = vrm.humanoid.getNormalizedBoneNode("rightHand");
      const leftIndex = vrm.humanoid.getNormalizedBoneNode("leftIndexProximal");
      const rightIndex = vrm.humanoid.getNormalizedBoneNode("rightIndexProximal");
      const leftMiddle = vrm.humanoid.getNormalizedBoneNode("leftMiddleProximal");
      const rightMiddle = vrm.humanoid.getNormalizedBoneNode("rightMiddleProximal");
      const nextBehavior = behaviorRef.current;
      const idleSwing = Math.sin(elapsedSec * 1.4) * 0.02;
      const handWave = Math.sin(elapsedSec * 2.1) * 0.06;
      const pose = nextBehavior.pose;

      applyBoneRotation(head, { x: idleSwing * 0.4, y: idleSwing * 0.35, z: 0 });
      applyBoneRotation(neck, { x: 0, y: idleSwing * 0.25, z: 0 });
      applyBoneRotation(spine, { x: 0, y: 0, z: 0 });
      applyBoneRotation(upperChest, { x: 0.01, y: 0, z: 0 });
      applyBoneRotation(leftShoulder, { x: -0.03, z: -0.12 });
      applyBoneRotation(rightShoulder, { x: -0.03, z: 0.12 });
      applyBoneRotation(leftUpperArm, { x: -0.1, z: -1.05 });
      applyBoneRotation(rightUpperArm, { x: -0.1, z: 1.05 });
      applyBoneRotation(leftLowerArm, { z: -0.16 });
      applyBoneRotation(rightLowerArm, { z: 0.16 });
      applyBoneRotation(leftHand, { x: 0.05, y: handWave * 0.3, z: -0.08 });
      applyBoneRotation(rightHand, { x: 0.05, y: -handWave * 0.3, z: 0.08 });
      applyBoneRotation(leftIndex, { x: 0.1 + handWave * 0.2 });
      applyBoneRotation(rightIndex, { x: 0.1 - handWave * 0.2 });
      applyBoneRotation(leftMiddle, { x: 0.08 + handWave * 0.15 });
      applyBoneRotation(rightMiddle, { x: 0.08 - handWave * 0.15 });

      if (pose === "upright") {
        applyBoneRotation(spine, { x: -0.03 });
        applyBoneRotation(upperChest, { x: -0.03 });
      }
      if (pose === "friendly") {
        applyBoneRotation(head, { x: 0.05, y: 0.03 });
        applyBoneRotation(leftHand, { z: -0.14 });
        applyBoneRotation(rightHand, { z: 0.14 });
      }
      if (pose === "leanForward") {
        applyBoneRotation(spine, { x: 0.05 });
        applyBoneRotation(upperChest, { x: 0.08 });
        applyBoneRotation(head, { x: -0.05 });
      }
      if (pose === "confident") {
        applyBoneRotation(spine, { x: -0.02, y: 0.02 });
        applyBoneRotation(leftUpperArm, { x: -0.15, z: -0.92 });
        applyBoneRotation(rightUpperArm, { x: -0.15, z: 0.92 });
      }

      switch (nextBehavior.gesture) {
        case "thinking":
          applyBoneRotation(head, { x: 0.12, y: -0.1 });
          applyBoneRotation(neck, { x: 0.06, y: -0.06 });
          applyBoneRotation(leftLowerArm, { z: -0.22 });
          applyBoneRotation(rightLowerArm, { z: 0.22 });
          break;
        case "listening":
          applyBoneRotation(head, { x: 0.03, y: 0.12 });
          applyBoneRotation(neck, { y: 0.08 });
          applyBoneRotation(spine, { y: 0.04 });
          break;
        case "explaining":
          applyBoneRotation(head, { x: -0.02, y: -0.06 });
          applyBoneRotation(leftUpperArm, { x: -0.12, z: -0.78 });
          applyBoneRotation(rightUpperArm, { x: -0.12, z: 0.78 });
          applyBoneRotation(leftLowerArm, { z: -0.28 });
          applyBoneRotation(rightLowerArm, { z: 0.28 });
          applyBoneRotation(leftHand, { y: 0.14, z: -0.2 });
          applyBoneRotation(rightHand, { y: -0.14, z: 0.2 });
          applyBoneRotation(leftIndex, { x: -0.15 });
          applyBoneRotation(rightIndex, { x: -0.15 });
          break;
        case "emphasis":
          applyBoneRotation(head, { x: -0.03, y: 0.06 });
          applyBoneRotation(neck, { x: -0.02 });
          applyBoneRotation(leftUpperArm, { x: -0.15, z: -0.7 });
          applyBoneRotation(rightUpperArm, { x: -0.15, z: 0.7 });
          applyBoneRotation(leftLowerArm, { z: -0.35 });
          applyBoneRotation(rightLowerArm, { z: 0.35 });
          applyBoneRotation(leftHand, { x: 0.12, y: 0.18, z: -0.25 });
          applyBoneRotation(rightHand, { x: 0.12, y: -0.18, z: 0.25 });
          break;
        case "armCross":
          applyBoneRotation(head, { x: 0.01, y: -0.02 });
          applyBoneRotation(leftShoulder, { x: 0.02, z: -0.22 });
          applyBoneRotation(rightShoulder, { x: 0.02, z: 0.22 });
          applyBoneRotation(leftUpperArm, { x: -0.35, y: 0.18, z: -0.45 });
          applyBoneRotation(rightUpperArm, { x: -0.35, y: -0.18, z: 0.45 });
          applyBoneRotation(leftLowerArm, { x: -0.18, y: 0.38, z: -0.95 });
          applyBoneRotation(rightLowerArm, { x: -0.18, y: -0.38, z: 0.95 });
          applyBoneRotation(leftHand, { x: 0.06, y: 0.1, z: 0.42 });
          applyBoneRotation(rightHand, { x: 0.06, y: -0.1, z: -0.42 });
          break;
        case "waveHand":
          applyBoneRotation(head, { x: -0.02, y: 0.12 });
          applyBoneRotation(rightShoulder, { x: -0.06, z: 0.36 });
          applyBoneRotation(rightUpperArm, { x: -0.85, y: -0.18, z: 0.18 });
          applyBoneRotation(rightLowerArm, { x: -0.52, y: -0.25, z: 1.08 });
          applyBoneRotation(rightHand, { x: 0.04, y: Math.sin(elapsedSec * 5.2) * 0.42, z: 0.22 });
          applyBoneRotation(leftUpperArm, { x: -0.04, z: -1.02 });
          applyBoneRotation(leftLowerArm, { z: -0.14 });
          break;
        case "pointFinger":
          applyBoneRotation(head, { x: -0.02, y: -0.05 });
          applyBoneRotation(rightUpperArm, { x: -0.2, y: -0.08, z: 0.58 });
          applyBoneRotation(rightLowerArm, { x: -0.14, y: -0.22, z: 0.84 });
          applyBoneRotation(rightHand, { x: 0.02, y: -0.1, z: 0.08 });
          applyBoneRotation(rightIndex, { x: -0.55 });
          applyBoneRotation(rightMiddle, { x: 0.28 });
          applyBoneRotation(leftUpperArm, { x: -0.08, z: -1.02 });
          applyBoneRotation(leftLowerArm, { z: -0.18 });
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
    setIsModelLoading(true);
    setError(null);
    loader.load(
      modelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);
        currentVrmRef.current = vrm;
        setIsModelLoading(false);
        setError(null);
        onModelReadyRef.current?.();
      },
      undefined,
      () => {
        setIsModelLoading(false);
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
      {isModelLoading ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(248,250,252,0.8)"
          }}
        >
          <style>
            {`@keyframes kagemushaAvatarSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}
          </style>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "999px",
              border: "3px solid #cbd5e1",
              borderTopColor: "#0f172a",
              animation: "kagemushaAvatarSpin 0.9s linear infinite"
            }}
          />
        </div>
      ) : null}
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
