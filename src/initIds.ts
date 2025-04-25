import { TableOptions } from "./types";
import { Obj } from "./utils";

type InitIds<Data> = {
  [Table in keyof Data]: {
    [TableEntry in keyof Data[Table]]: string;
  };
};
const mkInitIds = <Data extends Obj>(
  data: Data,
  id: Required<TableOptions>["id"]
): InitIds<Data> => {
  let initIds: InitIds<Data> = {} as any;
  for (const [tableKey, tableData] of Object.entries(data)) {
    (initIds as any)[tableKey] = {};
    for (const entryKey of Object.keys(tableData as Obj)) {
      (initIds as any)[tableKey][entryKey] = id(entryKey);
    }
  }
  return initIds;
};

export type { InitIds };
export { mkInitIds };
