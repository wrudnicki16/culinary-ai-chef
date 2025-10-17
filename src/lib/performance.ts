// Performance monitoring and optimization utilities

/**
 * Web Vitals reporter for monitoring performance
 */
export function reportWebVitals(metric: {name: string; id: string; value: number}) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Log to console in development, send to analytics in production
    console.log('Web Vitals:', metric);

    // Example: Send to analytics service
    // gtag('event', metric.name, {
    //   event_category: 'Web Vitals',
    //   event_label: metric.id,
    //   value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    //   non_interaction: true,
    // });
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources() {
  if (typeof window === 'undefined') return;

  const criticalResources = [
    // Preload critical fonts
    '/fonts/geist-sans.woff2',
    '/fonts/geist-mono.woff2',

    // Preload hero image
    'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=1920&h=600&fit=crop&fm=webp&q=85'
  ];

  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    if (resource.includes('font')) {
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
    } else {
      link.as = 'image';
    }
    link.href = resource;
    document.head.appendChild(link);
  });
}

/**
 * Optimize third-party scripts loading
 */
export function loadThirdPartyScripts() {
  if (typeof window === 'undefined') return;

  // Example: Load non-critical scripts after page load
  window.addEventListener('load', () => {
    // Load analytics after page load
    // loadAnalytics();

    // Load other non-critical scripts
    // loadChatWidget();
  });
}

/**
 * Intersection Observer for lazy loading
 */
export function createLazyLoadObserver(callback: (entry: IntersectionObserverEntry) => void) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver(
    (entries) => {
      entries.forEach(callback);
    },
    {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    }
  );
}

/**
 * Memory usage monitoring (development only)
 */
export function monitorMemoryUsage() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  if ('memory' in performance) {
    const memory = (performance as {memory: {usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number}}).memory;
    console.log('Memory Usage:', {
      used: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1048576) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) + 'MB'
    });
  }
}

/**
 * Performance timing logger
 */
export function logPerformanceTiming(name: string) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return { end: () => {} };
  }

  const start = performance.now();
  console.log(`⏱️  ${name} started`);

  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`⏱️  ${name} completed in ${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}