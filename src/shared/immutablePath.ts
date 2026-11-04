import type { ContentPath } from "../domain/deck/slideTypes.ts";

export function getValueAtPath(source: unknown, path: ContentPath): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, source);
}

export function withValueAtPath<T>(source: T, path: ContentPath, value: unknown): T {
  if (path.length === 0) return value as T;

  const [head, ...rest] = path;

  if (Array.isArray(source)) {
    const copy = source.slice();
    copy[head as number] = withValueAtPath(source[head as number], rest, value);
    return copy as T;
  }

  const base = (source && typeof source === "object" ? source : {}) as Record<string, unknown>;
  return { ...base, [head]: withValueAtPath(base[String(head)], rest, value) } as T;
}

export function appendValueAtPath<T>(source: T, path: ContentPath, item: unknown): T {
  const current = getValueAtPath(source, path);
  const list = Array.isArray(current) ? current : [];
  return withValueAtPath(source, path, [...list, item]);
}

export function removeValueAtPath<T>(source: T, path: ContentPath, index: number): T {
  const current = getValueAtPath(source, path);
  if (!Array.isArray(current)) return source;
  return withValueAtPath(
    source,
    path,
    current.filter((_, position) => position !== index),
  );
}

export function moveValueAtPath<T>(source: T, path: ContentPath, fromIndex: number, toIndex: number): T {
  const current = getValueAtPath(source, path);
  if (!Array.isArray(current)) return source;
  if (toIndex < 0 || toIndex >= current.length || fromIndex === toIndex) return source;

  const copy = current.slice();
  const movedItem: unknown = copy.splice(fromIndex, 1)[0];
  copy.splice(toIndex, 0, movedItem);
  return withValueAtPath(source, path, copy);
}
