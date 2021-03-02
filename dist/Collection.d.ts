import Mozel, { Data } from './Mozel';
import { MozelClass } from './Property';
import { Class, primitive } from 'validation-kit';
import Templater from "./Templater";
export declare type CollectionType = MozelClass | Class;
export declare type CollectionOptions = {
    reference?: boolean;
};
declare type AddedListener<T> = (item: T) => void;
declare type RemovedListener<T> = (item: T, index?: number) => void;
export default class Collection<T extends Mozel | primitive> {
    static get type(): string;
    private readonly type?;
    private list;
    private readonly removed;
    parent: Mozel;
    relation: string;
    isReference: boolean;
    addedListeners: AddedListener<T>[];
    removedListeners: RemovedListener<T>[];
    constructor(parent: Mozel, relation: string, type?: CollectionType, list?: never[]);
    getTypeName(): string;
    checkType(value: any): value is T;
    setParent(parent: Mozel): void;
    /**
     * Checks if the given item is a valid item for the Collection.
     * @param item							The item to check for the list.
     * @param {boolean} [init]	If set to `true`, Mozel Collections may try to initialize a Mozel based on the provided data.
     * @return 		Either the revised item, or `false`, if the item did not pass.
     */
    revise(item: any, init?: boolean): T | false;
    resolveReferences(): void;
    /**
     * Add an item to the Collection.
     * @param item							The item to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize a Mozel based on the given data.
     */
    add(item: T | object, init?: boolean): this;
    /**
     * Add an item to the Collection.
     * @param items							The items to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize Mozels based on the given data.
     */
    addItems(items: Array<object | T>, init?: boolean): this;
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]		If set to false, the item will not be kept in the `removed` list.
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
    clear(): this;
    find(specs: Data | T): T | undefined;
    each(func: (item: T, index: number) => any): T[];
    map<V>(func: (item: T, index: number) => V): V[];
    toArray(): T[];
    getRemovedItems(): T[];
    export(): (Data | primitive)[];
    /**
   * @param index
   * @return {Mozel}
   */
    get(index: number): T | undefined;
    set(index: number, item: T): void;
    isDefault(): boolean;
    renderTemplates(templater: Templater | Data): void;
    onAdded(callback: AddedListener<T>): void;
    onRemoved(callback: RemovedListener<T>): void;
}
export {};
