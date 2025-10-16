// Image optimization utilities for better performance

/**
 * Generate optimized image URLs with appropriate sizes and formats
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}
) {
  const { width = 800, height, quality = 85, format = 'webp' } = options;

  // Handle Unsplash images
  if (originalUrl.includes('unsplash.com')) {
    const url = new URL(originalUrl);
    url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    url.searchParams.set('q', quality.toString());
    url.searchParams.set('fm', format);
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('crop', 'faces,entropy');
    return url.toString();
  }

  return originalUrl;
}

/**
 * Generate responsive image sizes attribute
 */
export function getResponsiveSizes(breakpoints: {
  mobile?: number;
  tablet?: number;
  desktop?: number;
} = {}) {
  const { mobile = 100, tablet = 50, desktop = 33 } = breakpoints;

  return `(max-width: 768px) ${mobile}vw, (max-width: 1024px) ${tablet}vw, ${desktop}vw`;
}

/**
 * Generate srcSet for responsive images
 */
export function generateSrcSet(baseUrl: string, widths: number[] = [400, 800, 1200, 1600]) {
  return widths
    .map(width => `${getOptimizedImageUrl(baseUrl, { width })} ${width}w`)
    .join(', ');
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, as: 'image' = 'image') {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = src;
    link.as = as;
    document.head.appendChild(link);
  }
}

/**
 * Recipe image placeholder while loading
 */
export const RECIPE_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xODQgMTUwQzE4NCAxNTkuMzg5IDE5MS42MTEgMTY3IDIwMSAxNjdDMjEwLjM4OSAxNjcgMjE4IDE1OS4zODkgMjE4IDE1MEMyMTggMTQwLjYxMSAyMTAuMzg5IDEzMyAyMDEgMTMzQzE5MS42MTEgMTMzIDE4NCAxNDAuNjExIDE4NCAxNTBaIiBmaWxsPSIjOUI5Qjk5Ii8+CjwvZz4K';

/**
 * Lazy loading intersection observer options
 */
export const LAZY_LOADING_OPTIONS = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1
};