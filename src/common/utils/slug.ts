import slugifyLib from 'slugify';

/**
 * Generate a URL-safe slug from a string.
 * Used for product slugs, tenant slugs, category slugs, etc.
 */
export function generateSlug(text: string): string {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Generate a unique slug by appending a short random suffix.
 * Useful when slug conflicts are detected.
 */
export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}
