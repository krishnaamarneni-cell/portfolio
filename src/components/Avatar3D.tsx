"use client";

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

/* ============ SHARED AVATAR MODEL LOADER ============ */
function AvatarModel({
  url,
  mouseX,
  mouseY,
  scale = 1,
  positionY = -1.1,
  enableCursorTracking = true,
}: {
  url: string;
  mouseX: number;
  mouseY: number;
  scale?: number;
  positionY?: number;
  enableCursorTracking?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, mixer } = useAnimations(animations, group);
  const headBone = useRef<THREE.Bone | null>(null);
  const neckBone = useRef<THREE.Bone | null>(null);

  useEffect(() => {
    if (actions) {
      const keys = Object.keys(actions);
      if (keys.length > 0) {
        const action = actions[keys[0]];
        if (action) {
          action.reset().fadeIn(0.3).play();
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
      }
    }

    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const name = child.name.toLowerCase();
        if (name.includes("head") && !headBone.current) headBone.current = child as THREE.Bone;
        if (name.includes("neck") && !neckBone.current) neckBone.current = child as THREE.Bone;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }, [scene, actions]);

  useFrame((_, delta) => {
    if (!group.current) return;
    if (mixer) mixer.update(delta);

    if (enableCursorTracking) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, mouseX * 0.15, 0.03);
      if (headBone.current) {
        headBone.current.rotation.y = THREE.MathUtils.lerp(headBone.current.rotation.y, mouseX * 0.4, 0.05);
        headBone.current.rotation.x = THREE.MathUtils.lerp(headBone.current.rotation.x, mouseY * -0.15, 0.05);
      }
      if (neckBone.current) {
        neckBone.current.rotation.y = THREE.MathUtils.lerp(neckBone.current.rotation.y, mouseX * 0.1, 0.04);
      }
    }
  });

  return (
    <group ref={group} position={[0, positionY, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

/* ============ DROP MODEL — animation driven in useFrame, no React state ============ */
function DropModel({ mouseX, mouseY, onDone }: { mouseX: number; mouseY: number; onDone: () => void }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/avatar-drop.glb");
  const { actions, mixer } = useAnimations(animations, group);
  const startTime = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    startTime.current = performance.now() + 200;
    if (actions) {
      const keys = Object.keys(actions);
      if (keys.length > 0) {
        const action = actions[keys[0]];
        if (action) {
          action.reset().play();
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
      }
    }
  }, [scene, actions]);

  useFrame((_, delta) => {
    if (!group.current) return;
    if (mixer) mixer.update(delta);

    const now = performance.now();
    const elapsed = now - startTime.current;
    const dropDistance = 3.5;

    if (elapsed < 0) {
      group.current.position.y = -1.35 + dropDistance;
      return;
    }

    const duration = 1600;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    group.current.position.y = -1.35 + dropDistance * (1 - eased);

    if (progress >= 1 && !done.current) {
      done.current = true;
      setTimeout(onDone, 300);
    }
  });

  return (
    <group ref={group} position={[0, -1.35 + 3.5, 0]} scale={1}>
      <primitive object={scene} />
    </group>
  );
}

/* ============ HERO AVATAR (drop → standing transition) ============ */
export function HeroAvatar({
  mouseX,
  mouseY,
  className,
  onLanded,
}: {
  mouseX: number;
  mouseY: number;
  className?: string;
  onLanded?: () => void;
}) {
  const [phase, setPhase] = useState<"drop" | "standing">("drop");

  const handleDropDone = () => {
    setPhase("standing");
    onLanded?.();
  };

  return (
    <div className={className || "w-[240px] h-[480px] sm:w-[280px] sm:h-[530px] md:w-[320px] md:h-[580px] lg:w-[360px] lg:h-[640px]"}>
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 30 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={2} />
        <directionalLight position={[-3, 3, 3]} intensity={0.5} color="#ff6b00" />

        <Suspense fallback={null}>
          {phase === "drop" && (
            <DropModel mouseX={mouseX} mouseY={mouseY} onDone={handleDropDone} />
          )}
          {phase === "standing" && (
            <AvatarModel
              url="/avatar-standing.glb"
              mouseX={mouseX}
              mouseY={mouseY}
              scale={1}
              positionY={-1.35}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ============ SKILLS AVATAR (static with cursor tracking) ============ */
export function SkillsAvatar({
  mouseX,
  mouseY,
  className,
}: {
  mouseX: number;
  mouseY: number;
  className?: string;
}) {
  return (
    <div className={className || "w-[450px] h-[620px]"}>
      <Canvas
        camera={{ position: [0, -0.1, 5], fov: 35 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={2} />
        <directionalLight position={[-3, 3, 3]} intensity={0.5} color="#ff6b00" />

        <Suspense fallback={null}>
          <AvatarModel
            url="/avatar-skills.glb"
            mouseX={mouseX}
            mouseY={mouseY}
            scale={1.05}
            positionY={-1.3}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ============ DEFAULT EXPORT ============ */
export default function Avatar3D({ mouseX, mouseY, className }: { mouseX: number; mouseY: number; className?: string }) {
  return <HeroAvatar mouseX={mouseX} mouseY={mouseY} className={className} />;
}

// Preload models
useGLTF.preload("/avatar-drop.glb");
useGLTF.preload("/avatar-standing.glb");
useGLTF.preload("/avatar-skills.glb");
