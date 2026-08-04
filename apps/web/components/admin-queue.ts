export function hasInstanceQueue<T>(instanceAvailable: boolean, queue: T | null): queue is T {
  return instanceAvailable && queue !== null;
}
