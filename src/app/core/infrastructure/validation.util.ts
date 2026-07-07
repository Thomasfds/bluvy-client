type Obj = Record<string, unknown>;

export function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null;
}

/**
 * Asserts that `value` is a non-null object.
 * Use for root-level checks; narrows the type after the call.
 */
export function expectObject(value: unknown, ctx: string): asserts value is Obj {
  if (!isObject(value)) throw new Error(`${ctx}: expected object`);
}

/** Field-level helpers — each throws a consistent error if the assertion fails. */

export function expectString(obj: Obj, key: string, ctx: string): void {
  if (typeof obj[key] !== 'string') throw new Error(`${ctx}.${key}: expected string`);
}

export function expectNumber(obj: Obj, key: string, ctx: string): void {
  if (typeof obj[key] !== 'number') throw new Error(`${ctx}.${key}: expected number`);
}

export function expectBoolean(obj: Obj, key: string, ctx: string): void {
  if (typeof obj[key] !== 'boolean') throw new Error(`${ctx}.${key}: expected boolean`);
}

export function expectObjectField(obj: Obj, key: string, ctx: string): void {
  if (!isObject(obj[key])) throw new Error(`${ctx}.${key}: expected object`);
}

export function expectArray(obj: Obj, key: string, ctx: string): void {
  if (!Array.isArray(obj[key])) throw new Error(`${ctx}.${key}: expected array`);
}

export function expectNullableString(obj: Obj, key: string, ctx: string): void {
  if (obj[key] !== null && typeof obj[key] !== 'string')
    throw new Error(`${ctx}.${key}: expected string or null`);
}

export function expectNullableNumber(obj: Obj, key: string, ctx: string): void {
  if (obj[key] !== null && typeof obj[key] !== 'number')
    throw new Error(`${ctx}.${key}: expected number or null`);
}
