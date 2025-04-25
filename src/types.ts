import { EntityAdapter, EntityState } from "@reduxjs/toolkit";
import { Obj } from "./utils";

type Ref<Table> = { $ref: Table };

type ModelRefBuilder<Model extends Obj> = <K extends keyof Model>(
  key: K
) => Ref<K>;

type DataRef<Table, Id = string> = { $table: Table; id: Id };

type DataRefBuilders<Model extends Obj> = {
  [K in keyof Model]: <Id extends string>(id: Id) => DataRef<K, Id>;
};

type TableResolver<T, Data> = T extends null | undefined
  ? T
  : T extends Ref<infer TableName>
  ? DataRef<
      TableName,
      TableName extends keyof Data
        ? keyof Data[TableName] extends string
          ? keyof Data[TableName]
          : string
        : string
    >
  : T extends Array<infer U>
  ? TableResolver<U, Data>[]
  : T extends object
  ? { [K in keyof T]: TableResolver<T[K], Data> }
  : T;

type Entry<Data> = { id: string; label: string; d: Data };

type EntryOptions = { id?: string; label?: string };

type RecursiveData<Model, Data, ParentTable> = Data extends null | undefined
  ? Data
  : Data extends DataRef<infer TableName, string>
  ? TableName extends keyof Model
    ? TableName extends ParentTable
      ? DataRef<ParentTable, string>
      : RecursiveData<Model, Model[TableName], TableName>
    : never
  : Data extends Ref<infer TableName>
  ? TableName extends keyof Model
    ? TableName extends ParentTable
      ? DataRef<ParentTable, string>
      : RecursiveData<Model, Model[TableName], TableName>
    : never
  : Data extends Array<infer U>
  ? RecursiveData<Model, U, ParentTable>[]
  : Data extends object
  ? { [K in keyof Data]: RecursiveData<Model, Data[K], ParentTable> }
  : Data;

type TableEntityAdapters<Model> = {
  [K in keyof Model]: EntityAdapter<
    Entry<TableResolver<Model[K], string>>,
    string
  >;
};

type ModelTables<Model> = {
  [K in keyof Model]: EntityState<
    Entry<TableResolver<Model[K], string>>,
    string
  >;
};

type TableOptions = {
  id?: (entryKeyInPopulate: string) => string;
  label?: (entryKeyInPopulate: string) => string;
};

export type {
  Ref,
  DataRef,
  DataRefBuilders,
  Entry,
  TableResolver,
  TableOptions,
  ModelTables,
  ModelRefBuilder,
  TableEntityAdapters,
  EntryOptions,
  RecursiveData,
};
