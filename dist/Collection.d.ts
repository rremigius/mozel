import { PropertyInput, PropertyOptions, PropertyType, PropertyValue } from "./Property";
import Mozel, { Data, MozelEvents, PropertyData, ExportOptions, MozelConfig } from "./Mozel";
import { alphanumeric } from "validation-kit";
export type CollectionDataType<T> = ((PropertyData<Mozel>) & {
    '$items'?: PropertyData<T>[];
}) | PropertyData<T>[];
export declare class CollectionItemEvent<T> {
    item: T;
    index: number;
    constructor(item: T, index: number);
}
export declare class CollectionItemAddedEvent<T> extends CollectionItemEvent<T> {
}
export declare class CollectionItemRemovedEvent<T> extends CollectionItemEvent<T> {
}
export declare class CollectionEvents extends MozelEvents {
    added: import("event-interface-mixin").EventEmitter<CollectionItemAddedEvent<any>>;
    removed: import("event-interface-mixin").EventEmitter<CollectionItemRemovedEvent<any>>;
}
/**
 * COLLECTION decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param itemPropertyOptions								Options applied to the Collection itself
 * @param collectionPropertyOptions
 * @param collectionPropertyOptions.itemPropertyOptions		Options applied to all Collection items
 */
export declare function collection<T extends PropertyType>(runtimeType?: T, itemPropertyOptions?: PropertyOptions<T>, collectionPropertyOptions?: PropertyOptions<Collection<T>>): (target: Mozel, propertyName: string) => void;
export default class Collection<T extends PropertyType> extends Mozel {
    MozelDataType: CollectionDataType<T>;
    MozelConfigType: {
        itemType?: PropertyType;
        itemPropertyOptions?: PropertyOptions<T>;
    };
    static validateInitData(data: unknown): boolean;
    protected _count: number;
    protected _config: MozelConfig<Collection<T>>;
    /** Quick access list */
    protected _list: T[];
    $events: CollectionEvents;
    protected isCollectionIndex(key: alphanumeric): boolean;
    $setData(data: Data, merge?: boolean): void;
    $add(item: PropertyData<T>, init?: boolean): boolean;
    $property(property?: alphanumeric): import("./Property").default | null | undefined;
    $set(index: alphanumeric, value: PropertyInput, init?: boolean, merge?: boolean): boolean;
    $get(index: alphanumeric, resolveReference?: boolean): PropertyValue;
    $at(index: number, resolveReferences?: boolean): T;
    $remove(child: PropertyValue): void;
    $removeIndex(indexToRemove: number): void;
    $clear(): void;
    $undefineProperty(index: alphanumeric): void;
    $map<V>(func: (item: T, index: number) => V): V[];
    $each(func: (item: T, index: number) => void): void;
    $toArray(): T[];
    $length(): number;
    $export(options?: ExportOptions): Data;
    $notifyPropertyChanged(path: string[]): void;
}
