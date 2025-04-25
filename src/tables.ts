import { isDataRef } from "./guards";
import { InitIds } from "./initIds";
import { Entry, ModelTables, TableEntityAdapters } from "./types";
import { isPlainObject, Obj } from "./utils";

const updateEntryRefs =
  (initIds: InitIds<any>) =>
  (e: any): any => {
    if (isDataRef(e)) {
      const { $table, id } = e;
      return { $table, id: initIds[$table][id] };
    } else if (Array.isArray(e)) return e.map(updateEntryRefs(initIds));
    else if (!isPlainObject(e)) return e;
    else
      return Object.fromEntries(
        Object.entries(e).map(([key, value]) => [
          key,
          updateEntryRefs(initIds)(value),
        ])
      );
  };

const mkEntries = <Data extends Obj>(
  data: Data,
  initIds: InitIds<Data>,
  label: (str: string) => string
) => {
  let entries: Obj<Obj<Entry<any>>> = {};

  for (const [tableKey, tableData] of Object.entries(data)) {
    entries[tableKey] = {};
    for (const [entryKey, entryData] of Object.entries(tableData as Obj)) {
      entries[tableKey][entryKey] = {
        id: (initIds as any)[tableKey][entryKey],
        label: label(entryKey),
        d: updateEntryRefs(initIds)(entryData),
      };
    }
  }

  return entries;
};

const mkTables = <Model extends Obj, Data extends Obj>(
  adapters: TableEntityAdapters<Model>,
  data: Data,
  initIds: InitIds<Data>,
  label: (str: string) => string
) => {
  const entries = mkEntries(data, initIds, label);
  const tables: ModelTables<Model> = {} as any;
  for (const [tableKey, adapter] of Object.entries(adapters)) {
    const tableEntityState = adapter.addMany(
      adapter.getInitialState(),
      Object.values(entries[tableKey] || {})
    );
    (tables as any)[tableKey] = tableEntityState;
  }
  return tables;
};

export { mkTables };
