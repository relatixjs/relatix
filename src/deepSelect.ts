import { EntityState } from "@reduxjs/toolkit";
import {
  DataRef,
  Entry,
  ModelTables,
  RecursiveData,
  TableEntityAdapters,
  TableResolver,
} from "./types";
import { isPlainObject, Obj } from "./utils";
import { checkEntryExists } from "./select";
import { isDataRef } from "./guards";

type DeepSelectPayloadsResults<
  Model,
  K extends keyof Model,
  TableData = TableResolver<Model[K], any>
> = {
  byId: [string, RecursiveData<Model, TableData, K> | undefined];
  byIdExn: [string, RecursiveData<Model, TableData, K>];
  entities: [undefined, Obj<RecursiveData<Model, TableData, K>>];
  all: [undefined, RecursiveData<Model, TableData, K>[]];
  total: [undefined, number];
  ids: [undefined, string[]];
};

type DeepEntry<Model, TableKey extends keyof Model> = Model extends ModelTables<
  infer Tables
>
  ? DeepSelectPayloadsResults<
      Tables,
      TableKey extends keyof Tables ? TableKey : never
    >["byIdExn"][1]
  : never;

type DeepSelect<Model, Tables = ModelTables<Model>> = {
  [Table in keyof Model]: {
    [Selector in keyof DeepSelectPayloadsResults<
      Model,
      Table
    >]: undefined extends DeepSelectPayloadsResults<Model, Table>[Selector][0]
      ? (
          tables: Tables,
          depth?: number
        ) => DeepSelectPayloadsResults<Model, Table>[Selector][1]
      : (
          tables: Tables,
          payload: DeepSelectPayloadsResults<Model, Table>[Selector][0],
          depth?: number
        ) => DeepSelectPayloadsResults<Model, Table>[Selector][1];
  };
};

const isEntry = (e: any): e is Entry<any> =>
  e &&
  e.hasOwnProperty("id") &&
  e.hasOwnProperty("label") &&
  e.hasOwnProperty("d");

const selectEntryData = (e: Entry<any>) => e.d;

const undefinedRef = ({ $table, id }: DataRef<string, string>) =>
  `DataRef of id ${id} in table ${$table} is undefined`;

const selectRefEntry = <
  State extends Obj<EntityState<any, any>>,
  K extends keyof State & string
>(
  state: State,
  ref: DataRef<K, string>
) => state[ref.$table].entities[ref.id] as Entry<any> | undefined;

const fetchRef =
  <State extends Obj<EntityState<any, any>>, K extends keyof State & string>(
    state: State
  ) =>
  (ref: DataRef<K, string>) => {
    const data = selectRefEntry(state, ref);
    if (data !== undefined) return data.d;
    else throw new Error(undefinedRef(ref));
  };

const fetchWithDepth =
  <State extends Obj<EntityState<any, any>>>(
    state: State,
    currentTableKey: string,
    remainingDepth: number
  ) =>
  (e: any): any => {
    if (remainingDepth < 0) return e;

    if (isDataRef(e)) {
      if (e.$table === currentTableKey) return e;

      try {
        const fetchedData = fetchRef(state)(e); // Récupère les données pointées (.d)
        return fetchWithDepth(state, e.$table, remainingDepth - 1)(fetchedData);
      } catch (error) {
        console.warn(`Could not resolve reference: ${error}`);
        return e;
      }
    } else if (isEntry(e)) {
      const entryData = selectEntryData(e);

      return fetchWithDepth(
        state,
        currentTableKey,
        remainingDepth - 1
      )(entryData);
    } else if (Array.isArray(e))
      return e.map(fetchWithDepth(state, currentTableKey, remainingDepth));
    else if (isPlainObject(e)) {
      const result: Record<string, any> = {};
      for (const key in e) {
        if (Object.prototype.hasOwnProperty.call(e, key)) {
          result[key] = fetchWithDepth(
            state,
            currentTableKey,
            remainingDepth
          )(e[key]);
        }
      }
      return result;
    } else return e;
  };

const defaultDepth = 10;

const mkDeepSelect = <Model extends Obj>(
  adapters: TableEntityAdapters<Model>,
  model: Model
) => {
  const select: DeepSelect<Model> = {} as any;
  for (const tableKey of Object.keys(model)) {
    type Tables = ModelTables<Model>;

    const adapter = adapters[tableKey];

    const selectTableState = (tables: Tables) => tables[tableKey];

    const selectors = adapter.getSelectors();

    (select as any)[tableKey] = {
      byId: (tables: Tables, id: string, depth = defaultDepth) => {
        const table = selectTableState(tables);
        const entry = selectors.selectById(table, id);
        return fetchWithDepth(tables, tableKey, depth)(entry);
      },
      byIdExn: (tables: Tables, id: string, depth = defaultDepth) => {
        const table = selectTableState(tables);
        const entry = selectors.selectById(table, id);
        checkEntryExists(entry, tableKey, id);
        return fetchWithDepth(tables, tableKey, depth)(entry);
      },
      all: (tables: Tables, depth = defaultDepth) => {
        const table = selectTableState(tables);
        const entries = selectors.selectAll(table);
        return entries.map(fetchWithDepth(tables, tableKey, depth));
      },
      entities: (tables: Tables, depth = defaultDepth) => {
        const table = selectTableState(tables);
        const entities = table.entities;
        return Object.fromEntries(
          Object.entries(entities).map(([key, entry]) => [
            key,
            fetchWithDepth(tables, tableKey, depth)(entry),
          ])
        );
      },
    };
  }
  return select;
};

export type { DeepSelect, DeepEntry };
export { mkDeepSelect };
