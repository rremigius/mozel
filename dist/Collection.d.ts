import Mozel, { Data } from './Mozel';
import { MozelClass, PropertyValue } from './Property';
import { Class, primitive } from 'validation-kit';
import Templater from "./Templater";
export declare type CollectionType = MozelClass | Class;
export declare type CollectionOptions = {
    reference?: boolean;
};
declare type AddedListener<T> = (item: T, batch: BatchInfo) => void;
declare type RemovedListener<T> = (item: T, index: number, batch: BatchInfo) => void;
declare type BatchInfo = {
    index: number;
    total: number;
};
declare type CollectionItem = Mozel | primitive;
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
    beforeAddedListeners: AddedListener<CollectionItem>[];
    beforeRemovedListeners: RemovedListener<CollectionItem>[];
    addedListeners: AddedListener<CollectionItem>[];
    removedListeners: RemovedListener<CollectionItem>[];
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
    revise(item: any, init?: boolean): T | false;
    /**
     * Add an item to the Collection.
     * @param item					The item to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize a Mozel based on the given data.
     * @param {BatchInfo} [batch]	Provide batch information for the listeners. Defaults to {index: 0, total:1};
     */
    add(item: T | object, init?: boolean, batch?: BatchInfo): this;
    /**
     * Add an item to the Collection.
     * @param items							The items to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize Mozels based on the given data.
     */
    addItems(items: Array<object | T>, init?: boolean): this;
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]			If set to `true`, item will be kept in `removed` list.
     * @param {boolean} [batch]			Provide batch information for change listeners. Defaults to {index: 0, total: 1}.
     */
    removeIndex(index: number, track?: boolean, batch?: BatchInfo): T;
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
     * @param {BatchInfo} [batch]		If clear operation is part of a larger batch of operations, this sets the batch info.
     */
    clear(batch?: BatchInfo): this;
    find(specs: Data | T): T | undefined;
    each(func: (item: T, index: number) => any): T[];
    map<V>(func: (item: T, index: number) => V): V[];
    indexOf(item: T): number;
    toArray(): T[];
    getRemovedItems(): T[];
    /**
   * @param index
   * @return {Mozel}
   */
    get(index: number): T | undefined;
    set(index: number, item: T): void;
    notifyBeforeRemove(item: T, index: number, batch: BatchInfo): void;
    notifyRemoved(item: T, index: number, batch: BatchInfo): void;
    notifyBeforeAdd(item: T, batch: BatchInfo): void;
    notifyAdded(item: T, batch: BatchInfo): void;
    beforeAdd(callback: AddedListener<CollectionItem>): void;
    onAdded(callback: AddedListener<CollectionItem>): void;
    beforeRemoved(callback: RemovedListener<CollectionItem>): void;
    onRemoved(callback: RemovedListener<CollectionItem>): void;
    setData(items: Array<object | T>, init?: boolean): this;
    $setData: (items: Array<object | T>, init?: boolean) => this;
    setParent(parent: Mozel): void;
    $setParent: (parent: Mozel) => void;
    isDefault(): boolean;
    $isDefault: () => boolean;
    resolveReferences(): void;
    $resolveReferences: () => void;
    cloneDeep(): Collection<T>;
    $cloneDeep: () => Collection<T>;
    renderTemplates(templater: Templater | Data): void;
    $renderTemplates: (templater: Templater | Data) => void;
    path(path: string | string[]): PropertyValue;
    $path: (path: string | string[]) => PropertyValue;
    export(): (Data | primitive)[];
    $export: () => (Data | primitive)[];
    pathPattern(path: string | string[], startingPath?: string[]): {};
    $pathPattern: (path: string | string[], startingPath?: string[]) => {};
    get errors(): {
        [x: string]: Error;
    };
    get $errors(): {
        [x: string]: Error;
    };
    errorsDeep(): {
        [x: string]: Error;
    };
    $errorsDeep: () => {
        [x: string]: Error;
    };
}
export {};
