export { get, set, isPlainObject, isArray, isString, isBoolean, isNil, isFunction, isEmpty, uniqueId, debounce, has, includes, forEach, remove, mapValues, values, omit, isNumber, throttle, isEqual, find } from "lodash";
export declare function interval(ms: number): Promise<unknown>;
export declare function call(func: Function): any;
export declare function findDeep(object: Record<string, any>, predicate: (value: unknown, key: string) => boolean): Record<string, unknown> | undefined;
export declare function findAllDeep(object: Record<string, any>, predicate: (value: unknown, key: string) => boolean): Record<string, any>[];
