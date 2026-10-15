// Paths are JSON arrays: user-entered IDs never become object property paths.
export type Records = Record<string, unknown>;
export type Change = { key: string; value?: unknown; deleted?: boolean; token: string };
export function flatten(value: unknown): Records {
  const out: Records = {};
  function visit(v: unknown, path: string[]) {
    const key = JSON.stringify(path);
    if (Array.isArray(v) && v.every(x => x && typeof x === 'object' && typeof x.id === 'string')) {
      out[key] = { node: 'list', order: v.map(x => x.id) };
      for (const item of v) visit(item, [...path, item.id]);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = { node: 'object' };
      for (const [k, child] of Object.entries(v)) if (child !== undefined) visit(child, [...path, k]);
    } else out[key] = { node: 'value', value: v };
  }
  visit(value, []); return out;
}
export function inflate(records: Records): unknown {
  const children = new Map<string, string[]>();
  for (const key of Object.keys(records)) {
    const path = JSON.parse(key) as string[];
    if (!path.length) continue;
    const parent = JSON.stringify(path.slice(0, -1));
    children.set(parent, [...(children.get(parent) || []), path.at(-1)!]);
  }
  function read(path: string[]): unknown {
    const key = JSON.stringify(path), node = records[key] as { node: string; value?: unknown; order?: string[] } | undefined;
    if (!node) return undefined;
    if (node.node === 'value') return node.value;
    const keys = children.get(key) || [];
    if (node.node === 'list') {
      const order = [...new Set([...(node.order || []), ...keys])];
      return order.map(id => read([...path, id])).filter(x => x !== undefined);
    }
    return Object.fromEntries(keys.map(k => [k, read([...path, k])]).filter(([,v]) => v !== undefined));
  }
  return read([]);
}
export function diff(before: Records, after: Records): Change[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(key => ({ key, ...(key in after ? {value: after[key]} : {deleted:true}), token: crypto.randomUUID() }));
}
export function apply(records: Records, changes: Pick<Change,'key'|'value'|'deleted'>[]): Records {
  const next = {...records};
  for (const change of changes) { if (change.deleted) delete next[change.key]; else next[change.key] = change.value; }
  return next;
}
export function acknowledge(pending: Change[], sent: Change[]): Change[] {
  const tokens = new Set(sent.map(c => c.token)); return pending.filter(c => !tokens.has(c.token));
}
