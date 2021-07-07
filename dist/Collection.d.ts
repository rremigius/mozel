import Mozel, { Data } from './Mozel';
import { MozelClass, PropertyValue } from './Property';
import { Class, primitive } from 'validation-kit';
import Templater from "./Templater";
import EventInterface, { Event } from "event-interface-mixin";
export declare type CollectionType = MozelClass | Class;
export declare type CollectionOptions = {
    reference?: boolean;
};
declare type FindFunction<T> = (item: T, index: number) => boolean;
export declare class CollectionChangedEvent<T> extends Event<{
    item: T;
    index: number;
}> {
}
export declare class CollectionBeforeChangeEvent<T> extends Event<{
    item: T;
    index: number;
}> {
}
export declare class CollectionItemAddedEvent<T> extends Event<{
    item: T;
    index: number;
}> {
}
export declare class CollectionItemRemovedEvent<T> extends Event<{
    item: T;
    index: number;
}> {
}
export default class Collection<T extends Mozel | primitive> {
    static get type(): string;
    private readonly type?;
    private list;
    private readonly removed;
    /**
     * Type errors of items in the collection.
     */
    private _errors;
    parent: Mozel;
    relation: string;
    isReference: boolean;
    events: EventInterface;
    on: <T_1, E extends Event<T_1>>(event: import("event-interface-mixin").EventConstructor<T_1, E>, callback: import("event-interface-mixin").Callback<E>) => void;
    off: <T_1, E extends Event<T_1>>(event: import("event-interface-mixin").EventConstructor<T_1, E>, callback: import("event-interface-mixin").Callback<E>) => void;
    constructor(parent: Mozel, relation: string, type?: CollectionType, list?: T[]);
    getTypeName(): string;
    getType(): CollectionType | undefined;
    checkType(value: any): value is T;
    /**
     * Checks if the given item is a valid item for the Collection.
     * @param item							The item to check for the list.
     * @param {boolean} [init]	If set to `true`, Mozel Collections may try to initialize a Mozel based on the provided data.
     * @return 		Either the revised item, or `false`, if the item did not pass.
     */
    revise(item: any, init?: boolean): T;
    add(item: object | T, init?: boolean): object | T;
    addDefault(): object | T;
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]			If set to `true`, item will be kept in `removed` list.
     */
    removeIndex(index: number, track?: boolean): T;
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
    toArray(): T[];
    getRemovedItems(): T[];
    /**
    * @param index
    * @return {Mozel}
    */
    get(index: number): T | undefined;
    /**
     *
     * @param index
     * @param value
     * @param init
     * @param merge				If set to true, will keep the current mozel value if possible, only changing its data
     * @param notifyAddRemove	If set to false, will not fire add/remove events
     */
    set(index: number, value: object | T, init?: boolean, merge?: boolean, notifyAddRemove?: boolean): object | T;
    /**
     *
     * @param items
     * @param init
     * @param merge		If set to true, each item mozel will be kept if possible; only changing the data
     */
    setData(items: Array<object | T>, init?: boolean, merge?: boolean): void;
    getCounts(items: T[]): Map<T, number>;
    setParent(parent: Mozel): void;
    isDefault(): boolean;
    resolveReferences(): void;
    equals(other: Collection<any>): boolean;
    clone(): Collection<T>;
    cloneDeep(): Collection<T>;
    renderTemplates(templater: Templater | Data): void;
    path(path: string | string[]): PropertyValue;
    export(): (Data | primitive)[];
    pathPattern(path: string | string[], startingPath?: string[]): {};
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
