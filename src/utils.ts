type Obj<T = unknown> = Record<string, T>;

type BaseValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date
  | RegExp
  | ReadonlyArray<any> // Arrays are treated as leaf values for state updates
  | Function; // Functions are also treated as leaf values

type TreeOf<T> = { [key: string]: TreeOf<T> | T };

type IsLeafNode<T> = T extends BaseValue ? true : false;

type DeepPartial<T> =
  IsLeafNode<T> extends true
    ? T
    : T extends object
      ? {
          [P in keyof T]?: DeepPartial<T[P]>;
        }
      : T;

function isPlainObject(
  value: unknown
): value is Record<string | number | symbol, any> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof RegExp ||
    typeof value === "function"
  ) {
    return false;
  }
  return true;
}

function isLeafNodeValue(value: unknown): boolean {
  const type = typeof value;
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "bigint" ||
    type === "symbol" ||
    value === null || // typeof null is 'object', special check needed
    type === "undefined" ||
    type === "function" || // Functions considered leaves here
    value instanceof Date ||
    value instanceof RegExp ||
    Array.isArray(value) // Runtime check for arrays
  );
}

function updateTree<T>(tree: T, updates: DeepPartial<T>): void {
  if (!updates) {
    return;
  }
  for (const key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const typedKey = key as keyof T;
      const updateValue = (updates as any)[typedKey];
      const originalValue = tree[typedKey];

      if (isPlainObject(updateValue) && !isLeafNodeValue(updateValue)) {
        // And if the original value is not a plain object OR IS a leaf value...
        if (!isPlainObject(originalValue) || isLeafNodeValue(originalValue)) {
          // ...we create/replace with an empty object.
          (tree as any)[typedKey] = {};
        }
        // Descend recursively.
        updateTree(
          (tree as any)[typedKey],
          updateValue as DeepPartial<T[keyof T]>
        );
      } else {
        // Otherwise (primitive, null, array, date, function...), assign directly.
        (tree as any)[typedKey] = updateValue;
      }
    }
  }
}

export { isPlainObject, updateTree };
export type { Obj, TreeOf, DeepPartial };
