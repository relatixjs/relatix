import { createSelector } from "reselect";
import {
  Entry,
  ModelTables,
  TableEntityAdapters,
  TableResolver,
} from "./types";
import { Obj } from "./utils";

type SelectPayloadsResults<
  Model,
  K extends keyof Model,
  TableEntry = Entry<TableResolver<Model[K], any>>
> = {
  byId: [string, TableEntry | undefined];
  byIdExn: [string, TableEntry];
  entities: [undefined, Obj<TableEntry>];
  all: [undefined, TableEntry[]];
  total: [undefined, number];
  ids: [undefined, string[]];
};

type Select<Model, Tables = ModelTables<Model>> = {
  [Table in keyof Model]: {
    [Selector in keyof SelectPayloadsResults<
      Model,
      Table
    >]: undefined extends SelectPayloadsResults<Model, Table>[Selector][0]
      ? (tables: Tables) => SelectPayloadsResults<Model, Table>[Selector][1]
      : (
          tables: Tables,
          payload: SelectPayloadsResults<Model, Table>[Selector][0]
        ) => SelectPayloadsResults<Model, Table>[Selector][1];
  };
};

const checkEntryExists = (entry: any, tableKey: string, id: string) => {
  if (entry === undefined) {
    throw new Error(
      `[relatix] Entry with ID "${id}" not found in table "${tableKey}".`
    );
  }
};

const mkSelect = <Model extends Obj>(
  adapters: TableEntityAdapters<Model>,
  model: Model
) => {
  const select: Select<Model> = {} as any;
  for (const tableKey of Object.keys(model)) {
    type Tables = ModelTables<Model>;

    const adapter = adapters[tableKey];

    const selectTableState = (tables: Tables) => tables[tableKey];

    const selectors = adapter.getSelectors();

    (select as any)[tableKey] = {
      byId: createSelector(
        selectTableState,
        (_state: Tables, id: string) => id,
        (tableState, id) => selectors.selectById(tableState, id)
      ),
      byIdExn: createSelector(
        selectTableState,
        (_state: Tables, id: string) => id,
        (tableState, id) => {
          const entry = selectors.selectById(tableState, id);
          checkEntryExists(entry, tableKey, id);
          return entry;
        }
      ),
      entities: createSelector(selectTableState, selectors.selectEntities),
      all: createSelector(selectTableState, selectors.selectAll),
      total: createSelector(selectTableState, selectors.selectTotal),
      ids: createSelector(selectTableState, selectors.selectIds),
    };
  }
  return select;
};

export type { Select };
export { checkEntryExists, mkSelect };
