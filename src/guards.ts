import { DataRef } from "./types";

const isDataRef = <T extends string>(value: any): value is DataRef<T, string> =>
  value && value.hasOwnProperty("$table") && value.hasOwnProperty("id");

export { isDataRef };
