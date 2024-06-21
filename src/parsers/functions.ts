export { findLastIndex };

function findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => boolean, startIndex?: number, thisArgs?: any): number {
  for (let i = startIndex ? startIndex : (array.length - 1); i >= 0; i--) {
    if (predicate.call(thisArgs, array[i], i, array)) {
      return i;
    }
  }

  return -1;
}
