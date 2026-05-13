/**
 * Returns the last element of an array, or 0 if undefined.
 * 
 * Direct port from candleIndex2.html line 10554:
 *   const L=a=>a[a.length-1]??0;
 */
export const last = <T extends number>(a: readonly T[]): number => {
  return a[a.length - 1] ?? 0;
};

/** Alias matching the HTML reference name */
export const L = last;
