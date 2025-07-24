// frontend/src/components/builder/animate.ts
import type { Transition } from "framer-motion";
import { AnimationProps } from "./Properties";

export function getMotionConfig(anim?: AnimationProps): {
  initial: any;
  animate: any;
  transition: Transition;
} {
  // no animation → empty motion
  if (!anim?.type) {
    return { initial: {}, animate: {}, transition: {} };
  }

  const presets: Record<string, { initial: any; animate: any }> = {
    "fade-in": { initial: { opacity: 0 }, animate: { opacity: 1 } },
    "slide-up": {
      initial: { y: 20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
    },
    bounce: { initial: { y: 0 }, animate: { y: [0, -30, 0] } },
    pulse: { initial: { scale: 1 }, animate: { scale: [1, 1.05, 1] } },
  };

  const { initial, animate } = presets[anim.type] || presets["fade-in"];

  // convert "Infinity" string to actual Infinity
  const repeatCount = anim.repeat === "Infinity" ? Infinity : anim.repeat ?? 0;

  // build a properly-typed Transition
  const transition: Transition = {
    duration: anim.duration ?? 0.3,
    delay: anim.delay ?? 0,
    repeat: repeatCount,
    // only include repeatType when we're looping forever
    ...(repeatCount === Infinity ? { repeatType: "loop" as const } : {}),
    ease: "easeInOut",
  };

  return { initial, animate, transition };
}
