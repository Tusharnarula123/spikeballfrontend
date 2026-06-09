'use client';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeroProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle: string;
  images: { src: string; alt: string }[];
}

export const HeroSection = React.forwardRef<HTMLDivElement, HeroProps>(
  ({ title, subtitle, images, className, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const carouselRef = React.useRef<HTMLDivElement>(null);

    // Drag state
    const dragStart = React.useRef<number | null>(null);
    const isDragging = React.useRef(false);

    // Wheel throttle
    const wheelLocked = React.useRef(false);

    const handleNext = React.useCallback(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const handlePrev = React.useCallback(() => {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    // Auto-play — resets when user interacts
    const autoTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const startAuto = React.useCallback(() => {
      if (autoTimer.current) clearInterval(autoTimer.current);
      autoTimer.current = setInterval(handleNext, 4000);
    }, [handleNext]);

    React.useEffect(() => {
      startAuto();
      return () => { if (autoTimer.current) clearInterval(autoTimer.current); };
    }, [startAuto]);

    // Mouse wheel — horizontal scroll navigates, vertical scroll passes through
    React.useEffect(() => {
      const el = carouselRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; // let vertical scroll through
        e.preventDefault();
        if (wheelLocked.current) return;
        wheelLocked.current = true;
        setTimeout(() => { wheelLocked.current = false; }, 500);
        if (e.deltaX > 0) { handleNext(); } else { handlePrev(); }
        startAuto();
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [handleNext, handlePrev, startAuto]);

    // Mouse drag
    const onMouseDown = (e: React.MouseEvent) => {
      dragStart.current = e.clientX;
      isDragging.current = false;
    };
    const onMouseMove = (e: React.MouseEvent) => {
      if (dragStart.current === null) return;
      if (Math.abs(e.clientX - dragStart.current) > 5) isDragging.current = true;
    };
    const onMouseUp = (e: React.MouseEvent) => {
      if (dragStart.current === null) return;
      const delta = e.clientX - dragStart.current;
      if (Math.abs(delta) > 40) {
        delta < 0 ? handleNext() : handlePrev();
        startAuto();
      }
      dragStart.current = null;
    };

    // Touch drag
    const touchStart = React.useRef<number | null>(null);
    const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(delta) > 40) {
        delta < 0 ? handleNext() : handlePrev();
        startAuto();
      }
      touchStart.current = null;
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full flex flex-col items-center justify-center overflow-x-hidden bg-background text-foreground py-16 px-4',
          className
        )}
        {...props}
      >
        <div className="z-10 flex w-full flex-col items-center text-center space-y-10">
          {/* Header */}
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">{title}</h2>
            <p className="max-w-xl mx-auto text-gray-500 md:text-lg">{subtitle}</p>
          </div>

          {/* Carousel */}
          <div
            ref={carouselRef}
            className="relative w-full h-[320px] md:h-[420px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { dragStart.current = null; }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1000px' }}>
              {images.map((image, index) => {
                const offset = index - currentIndex;
                const total = images.length;
                // Shortest-path wrapping for infinite loop feel
                let pos = ((offset % total) + total) % total;
                if (pos > Math.floor(total / 2)) pos -= total;

                const isCenter = pos === 0;
                const isAdjacent = Math.abs(pos) === 1;

                return (
                  <div
                    key={index}
                    className="absolute w-44 h-80 md:w-60 md:h-[400px] transition-all duration-500 ease-in-out flex items-center justify-center"
                    style={{
                      transform: `translateX(${pos * 45}%) scale(${isCenter ? 1 : isAdjacent ? 0.85 : 0.7}) rotateY(${pos * -10}deg)`,
                      zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                      opacity: isCenter ? 1 : isAdjacent ? 0.45 : 0,
                      filter: isCenter ? 'blur(0px)' : 'blur(3px)',
                      visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                      pointerEvents: isCenter ? 'auto' : 'none',
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      draggable={false}
                      className="object-cover w-full h-full rounded-3xl shadow-xl"
                      style={{ border: '2px solid #0a0a0a' }}
                    />
                    {isCenter && (
                      <div className="absolute inset-0 rounded-3xl pointer-events-none"
                        style={{ boxShadow: '0 0 0 3px #FFB81C' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Nav buttons */}
            <Button variant="outline" size="icon"
              className="absolute left-2 sm:left-10 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20"
              style={{ backgroundColor: 'white', borderColor: '#0a0a0a', color: '#0a0a0a' }}
              onClick={() => { handlePrev(); startAuto(); }}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon"
              className="absolute right-2 sm:right-10 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 z-20"
              style={{ backgroundColor: 'white', borderColor: '#0a0a0a', color: '#0a0a0a' }}
              onClick={() => { handleNext(); startAuto(); }}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Dot indicators */}
          <div className="flex gap-2">
            {images.map((_, i) => (
              <button key={i} onClick={() => { setCurrentIndex(i); startAuto(); }}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === currentIndex ? '#FFB81C' : '#d1d1d1',
                  transform: i === currentIndex ? 'scale(1.4)' : 'scale(1)',
                }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
);
HeroSection.displayName = 'HeroSection';
