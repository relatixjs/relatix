import { DataRefBuilders, Entry, EntryOptions, TableResolver } from "./types";
import { Obj } from "./utils";
import { v4 as uuid } from "uuid";

type Create<Model extends Obj> = {
  [K in keyof Model]: (
    builder: (
      refBuilders: DataRefBuilders<Model>
    ) => TableResolver<Model[K], string>,
    options?: EntryOptions
  ) => Entry<TableResolver<Model[K], string>>;
};

const mkCreate = <Model extends Obj>(
  dataRefBuilders: DataRefBuilders<Model>
) => {
  const create: Create<Model> = {} as any;
  for (const tableKey of Object.keys(dataRefBuilders)) {
    (create as any)[tableKey] = (
      builder: (refBuilders: DataRefBuilders<Model>) => any,
      options?: EntryOptions
    ) => {
      const d = builder(dataRefBuilders);
      const id = options?.id ?? uuid();
      const label = options?.label ?? `${tableKey}_${id}`;
      return { id, label, d };
    };
  }
  return create;
};

export type { Create };
export { mkCreate };
