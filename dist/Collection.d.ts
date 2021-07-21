import Mozel, { Data, ExportOptions } from './Mozel';
import { MozelClass, PropertyValue } from './Property';
import EventInterface from "event-interface-mixin";
import { Class, primitive } from 'validation-kit';
import Templater from "./Templater";
export declare type CollectionType = MozelClass | Class;
export declare type CollectionOptions = {
    reference?: boolean;
};
export declare type CollectionMutations<T> = {
    changed?: {
        index: number;
        before: T;
        after: T;
    }[];
    added?: {
        index: number;
        item: T;
    }[];
    removed?: {
        index: number;
        item: T;
    }[];
};
declare type FindFunction<T> = (item: T, index: number) => boolean;
export declare class CollectionItemEvent<T> {
    item: T;
    index: number;
    constructor(item: T, index: number);
}
export declare class CollectionChangedEvent<T> {
    mutations: CollectionMutations<T>;
    constructor(mutations: CollectionMutations<T>);
}
export declare class CollectionBeforeChangeEvent<T> {
}
export declare class CollectionItemAddedEvent<T> extends CollectionItemEvent<T> {
}
export declare class CollectionItemRemovedEvent<T> extends CollectionItemEvent<T> {
}
export declare class CollectionEvents extends EventInterface {
    changed: import("event-interface-mixin").EventEmitter<CollectionChangedEvent<unknown>>;
    added: import("event-interface-mixin").EventEmitter<CollectionItemAddedEvent<any>>;
    removed: import("event-interface-mixin").EventEmitter<CollectionItemRemovedEvent<any>>;
    beforeChange: import("event-interface-mixin").EventEmitter<unknown>;
}
export default class Collection<T extends Mozel | primitive> {
    static get type(): string;
    static getCounts<T>(items: T[]): Map<T, number>;
    static getMutations<T>(before: T[], after: T[]): CollectionMutations<T>;
    private readonly type?;
    private readonly _list;
    private refs;
    private _errors;
    private _mozelDestroyedListener;
    parent: Mozel;
    relation: string;
    isReference: boolean;
    events: CollectionEvents;
    constructor(parent: Mozel, relation: string, type?: CollectionType, list?: T[]);
    protected get list(): T[];
    protected getList(resolveReferences?: boolean): T[];
    getTypeName(): string;
    getType(): CollectionType | undefined;
    isPrimitiveType(): boolean;
    isMozelType(): boolean;
    isCollectionType(): boolean;
    checkType(value: any): value is T;
    /**
     * Checks if the given item is a valid item for the Collection.
     * @param item							The item to check for the list.
     * @param {boolean} [init]	If set to `true`, Mozel Collections may try to initialize a Mozel based on the provided data.
     * @return 		Either the revised item, or `false`, if the item did not pass.
     */
    revise(item: any, init?: boolean): T;
    add(item: object | T, init?: boolean): boolean | object | T;
    addDefault(): boolean | object | T;
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [fireEvents]	If set to `false`, will not send modification events
     */
    removeIndex(index: number, fireEvents?: boolean): T;
    /**
   *
   * @param item
   * @param track      If true, the item will be stored in the 'removed' list and can still be retrieved with getRemovedItems().
   * @return {Collection}
   */
    remove(item: T | Data, track?: boolean): this;
    /**
     * Checks whether item is considered equal to listItem.
     * @param specs			Specs to check for equality.
     * @param listItem	Item from the list.
     */
    matches(specs: T | Data, listItem: T): boolean;
    get length(): number;
    /**
     * Clear all items from the list.
     */
    clear(): this;
    find(specs: Data | T | FindFunction<T>): T | undefined;
    each(func: (item: T, index: number) => any): T[];
    map<V>(func: (item: T, index: number) => V): V[];
    filter(func: (item: T, index: number) => boolean): T[];
    indexOf(item: T): number;
    /**
     *
     * @param {boolean} resolveReferences	If set to false, will not try to resolve any references.
     */
    toArray(resolveReferences?: boolean): T[];
    /**
     * @param index
     * @param {boolean} resolveReferences	If set to false, will not try to resolve references first.
     * @return {Mozel}
    */
    get(index: number, resolveReferences?: boolean): T | undefined;
    /**
     *
     * @param index
     * @param value
     * @param init
     * @param merge			If set to true, will keep the current mozel value if possible, only changing its data
     * @param fireEvents	If set to false, will not fire modification events
     */
    set(index: number, value: object | T, init?: boolean, merge?: boolean, fireEvents?: boolean): boolean | object | T;
    /**
     *
     * @param items
     * @param init
     * @param merge		If set to true, each item mozel will be kept if possible; only changing the data
     */
    setData(items: Array<object | T>, init?: boolean, merge?: boolean): void;
    setParent(parent: Mozel): void;
    isDefault(): boolean;
    resolveReference(index: number, errorOnNotFound?: boolean): (T & Mozel) | undefined;
    resolveReferences(recursive?: boolean): void;
    equals(other: Collection<any>): boolean;
    clone(): Collection<T>;
    cloneDeep(parent: Mozel): Collection<T>;
    renderTemplates(templater: Templater | Data): void;
    path(path: string | string[]): PropertyValue;
    pathPattern(path: string | string[], startingPath?: string[], resolveReferences?: boolean): {};
    setPath(path: string | string[], value: any, initAlongPath?: boolean): boolean | object | T | undefined;
    /**
     *
     * @param options Options to pass to each of the Mozel.$export calls.
     */
    export(options?: ExportOptions): (Data | primitive)[];
    get errors(): {
        [x: string]: Error;
    };
    get $errors(): {
        [x: string]: Error;
    };
    errorsDeep(): {
        [x: string]: Error;
    };
}
export {};
