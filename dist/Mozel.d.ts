import "reflect-metadata";
import Property, { Alphanumeric, ComplexValue, MozelClass, PropertyInput, PropertyOptions, PropertyType, PropertyValue } from './Property';
import Collection, { CollectionOptions, CollectionType } from './Collection';
import Templater from './Templater';
import MozelFactoryInterface from "./MozelFactoryInterface";
import Registry from "./Registry";
import { alphanumeric, primitive } from 'validation-kit';
import { LogLevel } from "log-control";
import PropertyWatcher, { PropertyChangeHandler, PropertyWatcherOptionsArgument } from "./PropertyWatcher";
import MozelFactory from "./MozelFactory";
import EventInterface from "event-interface-mixin";
export declare type Data = {
    [key: string]: any;
};
export declare type MozelConstructor<T extends Mozel> = {
    new (...args: any[]): T;
    type: string;
    create<T extends Mozel>(data?: MozelData<T>): T;
};
export declare type ExportOptions = {
    type?: string;
    keys?: string[];
    shallow?: boolean;
    nonDefault?: boolean;
};
export declare type PropertyKeys<T extends Mozel> = {
    [K in keyof T]: T[K] extends PropertyValue ? K : never;
}[keyof T];
export declare type CollectionData<T> = T extends Mozel ? MozelData<T>[] | T[] : T extends primitive ? T[] | Collection<T> : never;
export declare type PropertyData<T> = T extends PropertyValue ? T extends Mozel ? MozelData<T> : T extends Collection<infer C> ? CollectionData<C> : T : false;
export declare type MozelData<T extends Mozel> = T extends {
    MozelDataType: any;
} ? T['MozelDataType'] : {
    [K in PropertyKeys<T>]?: PropertyData<T[K]>;
};
export declare type PropertySchema<T> = {
    $: string;
    $path: string;
    $pathArray: string[];
    $type: PropertyType;
    $reference: boolean;
    $required: boolean;
    $collection: boolean;
};
export declare type CollectionSchema<C> = PropertySchema<C> & {
    $collection: true;
} & (C extends Mozel ? Omit<MozelSchema<C>, '$collection'> : PropertySchema<C>);
export declare type MozelSchema<T> = PropertySchema<T> & {
    $collection: false;
} & {
    [K in keyof T]-?: T[K] extends Mozel | undefined ? MozelSchema<Exclude<T[K], undefined>> : T[K] extends Collection<infer C> ? CollectionSchema<C> : PropertySchema<T[K]>;
};
declare type PropertyDefinition = {
    name: string;
    type?: PropertyType;
    options?: PropertyOptions;
};
declare type CollectionDefinition = {
    name: string;
    type?: CollectionType;
    options?: CollectionOptions;
};
declare type SchemaDefinition = {
    type: PropertyType;
    reference: boolean;
    required: boolean;
    collection: boolean;
    path: string[];
};
export { Alphanumeric, alphanumeric, MozelClass };
export { LogLevel };
export declare function isData(value: any): value is Data;
/**
 * PROPERTY decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param {object} options
 */
export declare function property(runtimeType?: PropertyType, options?: PropertyOptions): (target: Mozel, propertyName: string) => void;
export declare function string(options?: PropertyOptions): (target: Mozel, propertyName: string) => void;
export declare function number(options?: PropertyOptions): (target: Mozel, propertyName: string) => void;
export declare function boolean(options?: PropertyOptions): (target: Mozel, propertyName: string) => void;
/**
 * PROPERTY decorator factory
 * Defines a runtime type-safe Collection for this property and overrides the the current property
 * with a getter/setter to access the Collection.
 * @param {PropertyType} runtimeType
 * @param {CollectionOptions} options
 */
export declare function collection(runtimeType?: CollectionType, options?: CollectionOptions): (target: Mozel, propertyName: string) => void;
export declare const required = true;
export declare const immediate = true;
export declare const deep = true;
export declare const trackOld = true;
export declare const reference = true;
export declare const shallow = true;
export declare function schema<M extends Mozel>(MozelClass: MozelConstructor<M> & typeof Mozel): MozelSchema<M>;
export declare const $s: typeof schema;
export declare class DestroyedEvent {
    mozel: Mozel;
    constructor(mozel: Mozel);
}
export declare class ChangedEvent {
    path: string[];
    constructor(path: string[]);
}
export declare class MozelEvents extends EventInterface {
    destroyed: import("event-interface-mixin").EventEmitter<DestroyedEvent>;
    changed: import("event-interface-mixin").EventEmitter<ChangedEvent>;
}
/**
 * Mozel class providing runtime type checking and can be exported and imported to and from plain objects.
 */
export default class Mozel {
    _type?: string;
    static Events: typeof MozelEvents;
    static get type(): string;
    static test<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>): T;
    static createFactory(): MozelFactory;
    /**
     * Access to the logging utility of Mozel, which allows to set log levels and drivers for different components.
     */
    static get log(): import("log-control").default;
    static getPropertyDefinition(key: string): PropertyDefinition | undefined;
    static getCollectionDefinition(key: string): CollectionDefinition | undefined;
    /**
     * Get this Mozel's schema.
     * @param {SchemaDefinition} [definition]	The definition from the parent's
     */
    static $schema<M extends Mozel>(definition?: SchemaDefinition): MozelSchema<M>;
    static $<M extends Mozel>(definition?: SchemaDefinition): MozelSchema<M>;
    private static _classPropertyDefinitions;
    private static _classCollectionDefinitions;
    readonly $factory: MozelFactoryInterface;
    readonly $registry: Registry<Mozel>;
    private _properties;
    private _parent;
    private _relation;
    private _strict?;
    private readonly _watchers;
    private $parentLock;
    private _settingData;
    get settingData(): boolean;
    $root: boolean;
    $destroyed: boolean;
    $events: MozelEvents;
    gid: alphanumeric;
    /**
     * Define a property for the mozel.
     * @param {string} name					Name of the property
     * @param {PropertyType} [runtimeType]	Type to check at runtime
     * @param {PropertyOptions} [options]
     */
    static property(name: string, runtimeType?: PropertyType, options?: PropertyOptions): void;
    static defineClassProperty(name: string, runtimeType?: PropertyType, options?: PropertyOptions): void;
    /**
     * Define a collection for the mozel.
     * @param {string} name					Name of the collection
     * @param {CollectionType} runtimeType	Type to check on the items in the collection
     * @param {CollectionOptions} options
     */
    static collection(name: string, runtimeType?: CollectionType, options?: CollectionOptions): void;
    static defineClassCollection(name: string, runtimeType?: CollectionType, options?: CollectionOptions): void;
    /**
     * Instantiate a Mozel, based on raw data.
     * Set as $root, so will not destroy itself when removed from hierarchy.
     * @param {Data} [data]
     */
    static create<T extends Mozel>(data?: MozelData<T>): T;
    static getParentClass(): any;
    /**
     * Definitions of Properties made at class level.
     */
    protected static get classPropertyDefinitions(): Record<string, PropertyDefinition>;
    /**
     * Definitions of Collections made at class level.
     */
    protected static get classCollectionDefinitions(): Record<string, CollectionDefinition>;
    constructor(mozelFactory?: MozelFactoryInterface);
    get static(): typeof Mozel;
    $init(): void;
    get $properties(): Record<string, Property>;
    /**
     * Instantiate a Mozel based on the given class and the data.
     * @param Class
     * @param data
     */
    $create<T extends Mozel>(Class: MozelConstructor<T>, data?: MozelData<T>): T;
    $destroy(): void;
    /**
     * Will destroy itself if not root and without parent.
     */
    $maybeCleanUp(): void;
    /**
     * Removes the Mozel from its parent.
     * @param {boolean} makeRoot	Set to `true` to prevent the Mozel from cleaning up next tick.
     */
    $detach(makeRoot?: boolean): void;
    /**
     * Set the Mozel's parent Mozel.
     * @param {Mozel} parent			The parent this Mozel is a child of.
     * @param {string} relation			The name of the parent-child relationship.
     * @param {boolean} lock			Locks the Mozel to the parent, so it cannot be transferred to another parent.
     */
    $setParent(parent: Mozel, relation: string, lock?: boolean): void;
    $remove(child: Mozel, includeReferences?: boolean): void;
    $findParent(predicate: (mozel: Mozel, relation: string) => boolean): Mozel | undefined;
    /**
     * The Mozel's parent.
     */
    get $parent(): Mozel | null;
    /**
     * The Mozel's relation to its parent.
     */
    get $relation(): string | null;
    /**
     * @protected
     * For override. Any properties and collections of the mozel should be defined here.
     */
    $define(): void;
    /**
     * Defines a property to be part of the Mozel's data. Only defined properties will be exported and imported
     * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
     *
     * @param {string} name							The name of the property.
     * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
     * 																	Number, String, Alphanumeric, Boolean, (subclass of) Mozel, Collection or undefined.
     * @param {PropertyOptions} [options]
     */
    $defineProperty(name: string, type?: PropertyType, options?: PropertyOptions): Property;
    /**
     * Defines a property and instantiates it as a Collection.
     * @param {string} relation       				The relation name.
     * @param {Mozel} [type]       					The class of the items in the Collection.
     * @param {CollectionOptions} [options]
     * @return {Collection}
     */
    $defineCollection(relation: string, type?: CollectionType, options?: CollectionOptions): Collection<any>;
    /**
     * Set value with type checking.
     * @param {string} property				The name of the property
     * @param {PropertyInput} value		The value to set on the property
     * @param {boolean} init					If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
     * @param {boolean} merge					If set to true, Mozels will be kept if gid did not change; data will be set instead
     */
    $set(property: string, value: PropertyInput, init?: boolean, merge?: boolean): PropertyInput;
    /**
     * Get type-safe value of the given property.
     * @param {string} property
     * @param {boolean} resolveReference	If set to false, will not try to resolve any references.
     */
    $get(property: string, resolveReference?: boolean): PropertyValue;
    /**
     * Get the Property object with the given name.
     * @param property
     */
    $property(property: string): Property | undefined;
    /**
     * Alias of $property
     */
    $: (property: string) => Property | undefined;
    /**
     * Get value at given path (not type-safe).
     * @param {string|string[]} path
     * @param {boolean}	resolveReferences	If false, will not try to resolve any encountered references.
     */
    $path(path: string | string[], resolveReferences?: boolean): PropertyValue;
    /**
     * Gets all path values mathing the given path pattern.
     * @param {string|string[]} pathPattern	Path pattern to match. May include wildcards ('*').
     * @param {string[]} startingPath		Path to prepend to the resulting paths. Used for recursion.
     * @param {boolean} resolveReferences	If set to false, will not try to resolve any encountered references.
     */
    $pathPattern(pathPattern: string | string[], startingPath?: string[], resolveReferences?: boolean): Record<string, PropertyValue>;
    $getPath(): string;
    $getPathArray(): string[];
    $getPathFrom(mozel: Mozel): string;
    $getPathArrayFrom(mozel: Mozel): string[];
    $setPath(path: string | string[], value: any, initAlongPath?: boolean): unknown;
    /**
     * Sets all registered properties from the given data.
     * @param {object} data			The data to set into the mozel.
     * @param {boolean} merge		If set to `true`, only defined keys will be set.
     */
    $setData(data: Data, merge?: boolean): void;
    /**
     * Watch changes to the given path.
     * @param {PropertyWatcherOptionsArgument} options
     */
    $watch<T extends PropertyValue>(path: string | PropertySchema<T> | MozelSchema<T>, handler: PropertyChangeHandler<T>, options?: PropertyWatcherOptionsArgument): PropertyWatcher;
    /**
     * Get _watchers matching the given path.
     * @param {string} path
     */
    $watchers(path: string): PropertyWatcher[];
    $addWatcher(watcher: PropertyWatcher): void;
    $removeWatcher(watcher: PropertyWatcher): void;
    /**
     * If the given submozel is part of a collection of this mozel, will add the collection index of the submozel to
     * the given path.
     *
     * @param {Mozel} submozel	Direct submozel.
     * @param {string[]} path	Path to add the collection index to.
     * @return {string[]} 		New path including collection index (does not modify given path).
     */
    private $maybeAddCollectionIndex;
    /**
     * Notify that a property is about to change. Will set the current value for any relevant _watchers, so they can
     * compare the new value to the old value, and provide the old value to the handler.
     *
     * This just-in-time approach has the slight advantage that we don't have to keep copies of values that will
     * never change.
     *
     * @param {string[]} path		The path at which the change occurred.
     * @param {Mozel} [submozel] 	The direct submozel reporting the change.
     */
    $notifyPropertyBeforeChange(path: string[], submozel?: Mozel): void;
    /**
     * Check with all registered watchers if property can be changed to its new value.
     * @param {string[]} path
     * @param {Mozel} [submozel]
     */
    $validatePropertyChange(path: string[], submozel?: Mozel): boolean;
    /**
     * Notify that a property has changed. Will activate relevant _watchers.
     * @param {string[]} path		Path at which the property changed.
     * @param {Mozel} [submozel]	The direct submozel reporting the change.
     */
    $notifyPropertyChanged(path: string[], submozel?: Mozel): void;
    /**
     * Resolves the given reference.
     * @param {{gid:alphanumeric}} ref
     */
    $resolveReference(ref: {
        gid: alphanumeric;
    }): Mozel | undefined;
    /**
     * Resolves all reference Properties and Collections
     */
    $resolveReferences(): void;
    /**
     * Applies all defined defaults to the properties.
     */
    $applyDefaults(): void;
    /**
     * Check if any property has received a different value than its default.
     */
    $isDefault(): boolean;
    /**
     * Set only primitive properties from given data.
     * @param {Data} properties
     */
    $setPrimitiveProperties(properties: Data): void;
    /**
     * Get only primitive type properties.
     * @return {[key:string]:Primitive}
     */
    $getPrimitiveProperties(): {
        [key: string]: primitive;
    };
    /**
     * Get only complex type properties.
     * @return {[key:string]:ComplexValue}
     */
    $getComplexProperties(): {
        [key: string]: ComplexValue;
    };
    /**
     * Check if the given property is a primitive.
     * @param key
     */
    $isPrimitiveProperty(key: string): boolean;
    /**
     * Checks if the Mozel has a property
     * @param property
     */
    $has(property: string): boolean;
    $eachProperty(callback: (property: Property) => void): void;
    $mapProperties<T>(callback: (property: Property) => T): T[];
    /**
     * Export defined properties to a plain (nested) object.
     * @param {string} [options.type]				Passed on recursively to each $export, based on which Mozel classes
     * 												can determine the keys they should export.
     * @param {string|string[]} [options.keys]		Only the given keys will be exported. This is not passed down the hierarchy.
     * @return {Data}
     */
    $export(options?: ExportOptions): Data;
    /**
     * Creates a deep clone of the mozel.
     */
    $cloneDeep<T extends Mozel>(): T;
    /**
     * Can disable _strict type checking, so properties can have invalid values. Errors will be stored in the Properties
     * with invalid states.
     * When using the properties in non-_strict mode, always use type checking at runtime. Typescript will not complain.
     * @param _strict
     */
    set $strict(strict: boolean);
    get $strict(): boolean;
    /**
     * Returns validation errors in the Mozel
     * @param {boolean} deep	If set to `true`, will return all errors of all submozels recursively.
     * 							Defaults to `false`, returning only errors of direct properties.
     */
    get $errors(): Record<string, Error>;
    $errorsDeep(): Record<string, Error>;
    /**
     * Renders string templates in all properties of the Mozel, recursively.
     * @param {Templater|object} templater	A Templater to use to render the templates, or a data object to fill in the values.
     * If a data object is provided, a new Templater will be instantiated with that data object.
     */
    $renderTemplates(templater: Templater | Data): void;
    $forEachChild(callback: (mozel: Mozel, key: string) => void): void;
    get $name(): string;
    toString(): string;
}
