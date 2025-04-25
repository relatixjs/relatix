import { produce } from "immer";
import {
  Entry,
  ModelTables,
  TableEntityAdapters,
  TableResolver,
} from "./types";
import { DeepPartial, Obj, updateTree } from "./utils";
import { EntityId } from "@reduxjs/toolkit";

type Update<T extends Entry<any>, Id extends EntityId> = {
  id: Id;
  changes: DeepPartial<T>;
};

type CommitPayloads<
  Model,
  K extends keyof Model,
  TableEntry = Entry<TableResolver<Model[K], any>>,
> = {
  addOne: TableEntry;
  addMany: TableEntry[];
  upsertOne: TableEntry;
  upsertMany: TableEntry[];
  setOne: TableEntry;
  setMany: TableEntry[];
  setAll: TableEntry[];
  updateOne: Update<Entry<TableResolver<Model[K], any>>, string>;
  updateMany: Update<Entry<TableResolver<Model[K], any>>, string>[];
  removeOne: string;
  removeMany: string[];
  removeAll: undefined;
};

type Commit<Model, Tables = ModelTables<Model>> = {
  [Table in keyof Model]: {
    [Method in keyof CommitPayloads<
      Model,
      Table
    >]: undefined extends CommitPayloads<Model, Table>[Method]
      ? (tables: Tables) => Tables
      : (
          tables: Tables,
          payload: CommitPayloads<Model, Table>[Method]
        ) => Tables;
  };
};

const mkCommit = <Model extends Obj>(
  adapters: TableEntityAdapters<Model>,
  model: Model
) => {
  const commit: Commit<Model> = {} as any;
  for (const tableKey of Object.keys(model)) {
    type Tables = ModelTables<Model>;
    const adapter = adapters[tableKey];
    (commit as any)[tableKey] = {
      addOne: (tables: Tables, entry: Entry<any>) => {
        if (tables[tableKey].entities.hasOwnProperty(entry.id)) return tables;
        return {
          ...tables,
          [tableKey]: adapter.addOne(tables[tableKey], entry),
        };
      },
      addMany: (tables: Tables, entries: Entry<any>[]) => ({
        ...tables,
        [tableKey]: adapter.addMany(tables[tableKey], entries),
      }),
      upsertOne: (tables: Tables, entry: Entry<any>) => ({
        ...tables,
        [tableKey]: adapter.upsertOne(tables[tableKey], entry),
      }),
      upsertMany: (tables: Tables, entries: Entry<any>[]) => ({
        ...tables,
        [tableKey]: adapter.upsertMany(tables[tableKey], entries),
      }),
      setOne: (tables: Tables, entry: Entry<any>) => ({
        ...tables,
        [tableKey]: adapter.setOne(tables[tableKey], entry),
      }),
      setMany: (tables: Tables, entries: Entry<any>[]) => ({
        ...tables,
        [tableKey]: adapter.setMany(tables[tableKey], entries),
      }),
      setAll: (tables: Tables, entries: Entry<any>[]) => ({
        ...tables,
        [tableKey]: adapter.setAll(tables[tableKey], entries),
      }),
      updateOne: (tables: Tables, { id, changes }: Update<any, any>) => {
        const table = tables[tableKey];
        const entry = table.entities[id];
        if (entry === undefined) return tables;
        const updatedEntry = produce(entry, (draft) => {
          updateTree(draft, changes);
        });
        return {
          ...tables,
          [tableKey]: adapter.setOne(tables[tableKey], updatedEntry),
        };
      },
      updateMany: (tables: Tables, updates: Update<any, any>[]) => {
        const table = tables[tableKey];
        const updatedEntries = updates.reduce(
          (acc, { id, changes }) => {
            const entry = table.entities[id];
            if (entry === undefined) return acc;
            const updatedEntry = produce(entry, (draft) => {
              updateTree(draft, changes);
            });
            return [...acc, updatedEntry];
          },
          [] as [] as Entry<any>[]
        );
        return {
          ...tables,
          [tableKey]: adapter.setMany(tables[tableKey], updatedEntries),
        };
      },
      removeOne: (tables: Tables, id: string) => {
        if (!tables[tableKey].entities.hasOwnProperty(id)) return tables;

        return {
          ...tables,
          [tableKey]: adapter.removeOne(tables[tableKey], id),
        };
      },
      removeMany: (tables: Tables, ids: string[]) => ({
        ...tables,
        [tableKey]: adapter.removeMany(tables[tableKey], ids),
      }),
      removeAll: (tables: Tables) => ({
        ...tables,
        [tableKey]: adapter.removeAll(tables[tableKey]),
      }),
    };
  }
  return commit;
};

export type { Commit };
export { mkCommit };
