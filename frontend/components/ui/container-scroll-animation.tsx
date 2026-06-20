"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, useSpring, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  // Raw scroll progress jumps around on mobile (momentum scrolling fires
  // fewer, larger events than desktop) which made the tilt/scale visibly
  // stutter. Smoothing it through a spring gives buttery interpolation
  // between scroll events instead of snapping straight to each new value.
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 35,
    restDelta: 0.001,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = () => (isMobile ? [0.85, 1] : [1.05, 1]);
  // A full 20° tilt combined with the perspective wrapper is what reads as
  // "glitchy" on phone GPUs (heavy repaint while clipping the table inside)
  // — keep a much subtler tilt on mobile, full tilt on larger screens.
  const rotateRange = () => (isMobile ? [8, 0] : [20, 0]);

  // Complete rotation at 55% of scroll so card is perfectly flat long before section ends
  const rotate    = useTransform(smoothProgress, [0, 0.55], rotateRange());
  const scale     = useTransform(smoothProgress, [0, 0.55], scaleDimensions());
  // No vertical translate — keeps card centered
  const translate = useTransform(smoothProgress, [0, 1], [0, 0]);

  return (
    <div
      className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div className="py-10 md:py-40 w-full relative" style={{ perspective: "1200px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: any) => (
  <motion.div
    style={{ translateY: translate }}
    className="max-w-5xl mx-auto text-center"
  >
    {titleComponent}
  </motion.div>
);

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      border: "3px solid #0a0a0a",
      backgroundColor: "#0a0a0a",
      boxShadow:
        "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a",
      willChange: "transform",
      backfaceVisibility: "hidden",
    }}
    className="max-w-5xl mt-8 mx-auto h-[30rem] md:h-[40rem] w-full p-2 md:p-3 rounded-[30px] shadow-2xl"
  >
    <div className="h-full w-full overflow-hidden rounded-2xl bg-white">
      {children}
    </div>
  </motion.div>
);
