import React, { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

/**
 * Scroll reveal: the content fades and moves into place the first time it enters
 * the screen, then stays. Without IntersectionObserver, or when the visitor asks
 * for reduced motion, it is simply shown.
 *
 * @param {Object} props
 * @param {'up'|'left'|'right'|'zoom'} [props.variant]
 * @param {number} [props.delay] Milliseconds, for staggering siblings.
 */
export function Reveal({ as: Tag = 'div', variant = 'up', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      className={`reveal reveal-${variant} ${isVisible ? 'is-visible' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Parallax: the content drifts at a different speed from the page while scrolling.
 * Positive speeds lag behind the page, negative ones move ahead of it. It stays
 * still on small screens and when the visitor asks for reduced motion.
 *
 * @param {Object} props
 * @param {number} props.speed Fraction of the distance from the screen center.
 */
export function Parallax({ speed, className = '', children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const isWide = window.matchMedia?.('(min-width: 768px)')?.matches;
    if (!isWide || prefersReducedMotion()) return undefined;

    let frame = null;
    let offset = 0;
    const update = () => {
      frame = null;
      const rect = element.getBoundingClientRect();
      const center = rect.top - offset + rect.height / 2;
      offset = (center - window.innerHeight / 2) * speed;
      element.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
