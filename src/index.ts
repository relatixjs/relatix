import { Obj } from "./utils";
import { TableOptions } from "./types"; // Assuming Entry is also defined in ./types
import { v4 as uuid } from "uuid";
import { mkTableBuilder, Stage, TableBuilder } from "./builders";
import { SelfRef as SelfRefConst } from "./consts"; // Assuming SelfRef is defined here

/**
 * Default options for table creation, used when no options are provided to `Tables`.
 * Specifies UUID v4 for ID generation and uses the populate key for label generation.
 * @internal
 * @readonly
 */
const defaultOptions: Required<TableOptions> = {
  id: () => uuid(),
  label: (entryKeyInPopulate) => entryKeyInPopulate,
};

/**
 * Initializes the Relatix table model builder.
 * This is the entry point for defining your relational schema and data.
 *
 * @template Options - The type of the user-provided table options.
 * @template Model - Represents the structure (schema) of the tables being defined. Defaults to an empty object.
 * @template Data - Represents the structure of the initial data provided during population. Defaults to an empty object.
 * @template S - Represents the current stage of the builder (`"init"`, `"tablesAdded"`, `"populated"`). Defaults to `"init"`.
 *
 * @param options - Optional configuration object (`TableOptions`) to customize
 * default behavior, such as ID and label generation for table entries.
 * If omitted, default options are used (UUID for id, populate key for label).
 * @returns An initial `TableBuilder` instance. Chain methods like `.addTables()` and `.populate()`
 * to define and populate your model, finishing with `.done()`.
 *
 * @example
 * import { Tables, Text, Number } from 'relatix';
 *
 * const modelBuilder = Tables()
 * .addTables({
 * Users: { name: Text, age: Number }
 * });
 * // ... chain further methods like .populate().done()
 */
const Tables = <
  Options extends TableOptions,
  Model extends Obj = {},
  Data extends Obj = {},
  S extends Stage = "init"
>(
  options?: Options
): TableBuilder<Model, Data, S> => {
  // Merge provided options with defaults
  const mergedOptions: Required<TableOptions> = {
    ...defaultOptions,
    ...options,
  };
  // Create and return the initial builder instance
  return mkTableBuilder(mergedOptions, {}, {}) as any; // Cast needed due to internal implementation details
};

/**
 * A type helper constant used during table definition (`.addTables`)
 * to infer a `string` type for a field.
 * Using `Text` provides better semantic clarity than using a sample string literal.
 * The actual value (`""`) is irrelevant at runtime and used only for type inference.
 * @readonly
 * @example
 * const builder = Tables().addTables({
 * Users: {
 * name: Text, // infers string type
 * email: Text, // infers string type
 * }
 * });
 */
const Text = "";

/**
 * A type helper constant used during table definition (`.addTables`)
 * to infer a `number` type for a field.
 * Using `Number` provides better semantic clarity than using a sample number literal.
 * The actual value (`1.0`) is irrelevant at runtime and used only for type inference.
 * @readonly
 * @example
 * const builder = Tables().addTables({
 * Products: {
 * price: Number, // infers number type
 * stock: Number, // infers number type
 * }
 * });
 */
const Number = 1.0;

/**
 * Represents a normalized entry within a Relatix table.
 * Each entry has a unique `id`, a `label` (often derived from the initial populate key),
 * and a `d` property containing the actual data fields.
 * @see {@link ./types.ts}
 */
export type { Entry } from "./types";

/**
 * A helper type that computes the shape of a table entry *after* its references
 * have been recursively resolved by `deepSelect` utilities.
 * References to other tables are replaced by their corresponding `DeepEntry` types,
 * while self-references (`SelfRef`) within a table are replaced by `DataRef` to prevent infinite type recursion.
 * @see {@link ./deepSelect.ts}
 */
export type { DeepEntry } from "./deepSelect";

/**
 * A constant used within table definitions (`.addTables`) to declare a field
 * that references another entry within the *same* table.
 * This is used for creating relationships like linked lists, trees, or referencing related entities
 * of the same type (e.g., `manager` field in an `Employees` table).
 * @readonly
 * @see {@link ./consts.ts}
 * @example
 * const builder = Tables().addTables({
 * Employees: {
 * name: Text,
 * manager: SelfRef | null // manager is another Employee or null
 * }
 * });
 */
export const SelfRef = SelfRefConst;

// Export the main factory function
export { Tables };

// Re-export the type helpers
export { Text, Number };
