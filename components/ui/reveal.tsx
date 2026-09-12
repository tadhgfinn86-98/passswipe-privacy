"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** seconds */
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "article" | "header" | "span";
};

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  once = true,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.25, margin: "0px 0px -80px 0px" }}
      transition={{
        duration: reduce ? 0.2 : 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}
