import { createEntityAdapter } from "@reduxjs/toolkit";
import {
  DataRefBuilders,
  ModelRefBuilder,
  ModelTables,
  Ref,
  TableEntityAdapters,
  TableOptions,
  TableResolver,
} from "./types";
import { Obj } from "./utils";
import { mkTables } from "./tables";
import { InitIds, mkInitIds } from "./initIds";
import { Create, mkCreate } from "./create";
import { Commit, mkCommit } from "./commit";
import { mkSelect, Select } from "./select";
import { DeepSelect, mkDeepSelect } from "./deepSelect";
import { SelfRef } from "./consts";

type Stage = "init" | "addTable" | "populate";

type SelfRefResolver<T, Table> = T extends null | undefined
  ? T
  : T extends typeof SelfRef
  ? Ref<Table>
  : T extends Array<infer U>
  ? SelfRefResolver<U, Table>[]
  : T extends object
  ? { [K in keyof T]: SelfRefResolver<T[K], Table> }
  : T;

type ModelTypes<Model> = {
  [K in keyof Model]: SelfRefResolver<Model[K], K>;
};

type AddTables<Model extends Obj> = <NewTables extends Obj>(
  modelBuilder: NewTables | ((builder: ModelRefBuilder<Model>) => NewTables)
) => TableBuilder<Model & ModelTypes<NewTables>, {}, "addTable">;

type Populate<Model extends Obj, Data> = <
  NewData extends {
    [K in keyof Model]?: Obj<TableResolver<Model[K], NewData>>;
  }
>(
  dataBuilder: (refBuilders: DataRefBuilders<Model>) => NewData
) => TableBuilder<Model, Data & NewData, "populate">;

type ModelHandles<Model extends Obj, Data> = {
  create: Create<Model>;
  tables: ModelTables<Model>;
  commit: Commit<Model>;
  select: Select<Model>;
  deepSelect: DeepSelect<Model>;
  initIds: InitIds<Data>;
};

type TableBuilder<
  Model extends Obj = {},
  Data = {},
  S extends Stage = "init"
> = S extends "init"
  ? {
      addTables: AddTables<Model>;
    }
  : S extends "addTable"
  ? {
      addTables: AddTables<Model>;
      populate: Populate<Model, Data>;
      done: () => ModelHandles<Model, Data>;
    }
  : S extends "populate"
  ? { done: () => ModelHandles<Model, Data> }
  : never;

const mkDataRefBuilders = <Model extends Obj>(model: Model) => {
  const dataRefBuilders: DataRefBuilders<Model> = {} as any;
  for (const table of Object.keys(model)) {
    (dataRefBuilders as any)[table] = (id: string) => ({ $table: table, id });
  }
  return dataRefBuilders;
};

const mkModelRef = (key: string) => ({ $ref: key });

const mkTableEntityAdapters = <Model extends Obj>(model: Model) => {
  const tableEntityAdapters: TableEntityAdapters<Model> = {} as any;
  for (const table of Object.keys(model)) {
    const adapter = createEntityAdapter();
    (tableEntityAdapters as any)[table] = adapter;
  }
  return tableEntityAdapters;
};

const mkNextTables = <Model extends Obj, NewTables extends Obj>(
  payload: NewTables | ((builder: ModelRefBuilder<Model>) => NewTables)
) =>
  typeof payload === "function"
    ? payload(mkModelRef as ModelRefBuilder<Model>)
    : payload;

const mkTableBuilder = <Model extends Obj = {}, Data extends Obj = {}>(
  options: Required<TableOptions>,
  model: Model,
  data: Data
) => {
  return {
    addTables: <NewTables extends Obj>(
      payload: NewTables | ((builder: ModelRefBuilder<Model>) => NewTables)
    ) => {
      const nextTables = mkNextTables(payload);
      return mkTableBuilder(options, { ...model, ...nextTables }, {});
    },
    populate: (
      dataBuilder: <NewData>(refBuilders: DataRefBuilders<Model>) => NewData
    ) => {
      const dataRefBuilders = mkDataRefBuilders(model);
      const data = dataBuilder(dataRefBuilders) as Obj;
      return mkTableBuilder(options, model, data);
    },
    done: () => {
      const adapters = mkTableEntityAdapters(model);
      const dataRefBuilders = mkDataRefBuilders(model);
      const initIds = mkInitIds(data, options.id);

      return {
        tables: mkTables(adapters, data, initIds, options.label),
        initIds,
        create: mkCreate(dataRefBuilders),
        commit: mkCommit(adapters, model),
        select: mkSelect(adapters, model),
        deepSelect: mkDeepSelect(adapters, model),
      };
    },
  };
};

export type { TableBuilder, Stage };
export { mkTableBuilder };
