import "reflect-metadata";
import Property, { Alphanumeric, MozelClass, PropertyInput, PropertyOptions, PropertyType, PropertyValue } from './Property';
import Templater from './Templater';
import MozelFactoryInterface from "./MozelFactoryInterface";
import Registry from "./Registry";
import { alphanumeric, primitive } from 'validation-kit';
import { LogLevel } from "log-control";
import PropertyWatcher, { PropertyChangeHandler, PropertyWatcherOptionsArgument } from "./PropertyWatcher";
import EventInterface from "event-interface-mixin";
export type Data = {
    [key: string]: any;
};
export type MozelConstructor<T extends Mozel> = {
    new (...args: any[]): T;
    type: string;
    create<T extends Mozel>(data?: MozelData<T>): T;
};
export type ExportOptions = {
    type?: string;
    keys?: string[];
    shallow?: boolean;
    nonDefault?: boolean;
};
export type PropertyKeys<T extends Mozel> = {
    [K in keyof T]: T[K] extends PropertyValue ? K : never;
}[keyof T];
export type PropertyData<T> = T extends PropertyValue ? T extends Mozel ? MozelData<T> : T : never;
export type MozelData<T extends Mozel> = T | (T extends {
    MozelDataType: any;
} ? T['MozelDataType'] : {
    [K in PropertyKeys<T>]?: PropertyData<T[K]>;
});
export type PropertySchema<T> = {
    $: string;
    $path: string;
    $pathArray: string[];
    $type: PropertyType;
    $reference: boolean;
    $required: boolean;
};
export type MozelSchema<T> = PropertySchema<T> & {
    [K in keyof T]-?: T[K] extends Mozel | undefined ? MozelSchema<Exclude<T[K], undefined>> : PropertySchema<T[K]>;
};
export type MozelConfig<T extends Mozel> = T['MozelConfigType'];
type PropertyDefinition<T extends PropertyType> = {
    name: string;
    type?: PropertyType;
    options?: PropertyOptions<T>;
};
type SchemaDefinition = {
    type: PropertyType;
    reference: boolean;
    required: boolean;
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
 * @param {object} propertyOptions
 */
export declare function property<T extends PropertyType>(runtimeType?: T, propertyOptions?: PropertyOptions<T>): (target: Mozel, propertyName: string) => void;
export declare function string(options?: PropertyOptions<StringConstructor>): (target: Mozel, propertyName: string) => void;
export declare function number(options?: PropertyOptions<NumberConstructor>): (target: Mozel, propertyName: string) => void;
export declare function boolean(options?: PropertyOptions<BooleanConstructor>): (target: Mozel, propertyName: string) => void;
export declare const required = true;
export declare const immediate = true;
export declare const deep = true;
export declare const trackOld = true;
export declare const reference = true;
export declare const shallow = true;
export declare function schema<M extends Mozel>(MozelClass: MozelConstructor<M> & typeof Mozel): MozelSchema<M>;
export declare class DestroyedEvent {
    mozel: Mozel;
    constructor(mozel: Mozel);
}
export declare class ChangedEvent {
    path: string;
    constructor(path: string);
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
    MozelConfigType: {};
    static get type(): string;
    static test<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>): T;
    /**
     * Access to the logging utility of Mozel, which allows to set log levels and drivers for different components.
     */
    static get log(): import("log-control").default;
    static getPropertyDefinition(key: string): PropertyDefinition<any> | undefined;
    static validateInitData(data: unknown): boolean;
    /**
     * Get this Mozel's schema.
     * @param {SchemaDefinition} [definition]	The definition from the parent's
     */
    static $schema<M extends Mozel>(definition?: SchemaDefinition): MozelSchema<M>;
    static $<M extends Mozel>(definition?: SchemaDefinition): MozelSchema<M>;
    private static _classPropertyDefinitions;
    readonly $factory: MozelFactoryInterface;
    readonly $registry: Registry<Mozel>;
    protected _config: MozelConfig<Mozel>;
    private _properties;
    private _property;
    private _propertyLock;
    private _strict?;
    private readonly _watchers;
    private _trackChangesID?;
    private _trackedChangePaths;
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
    static property<T extends PropertyType>(name: string, runtimeType?: T, options?: PropertyOptions<T>): void;
    static defineClassProperty<T extends PropertyType>(name: string, runtimeType?: T, options?: PropertyOptions<T>): void;
    /**
     * Instantiate a Mozel, based on raw data.
     * Set as $root, so will not destroy itself when removed from hierarchy.
     * @param {Data} [data]
     * @param config
     */
    static create<T extends Mozel>(data?: MozelData<T>, config?: MozelConfig<T>): T;
    static getParentClass(): any;
    /**
     * Definitions of Properties made at class level.
     */
    protected static get classPropertyDefinitions(): Record<string, PropertyDefinition<PropertyType>>;
    constructor(mozelFactory?: MozelFactoryInterface);
    $setConfig(config: MozelConfig<Mozel>): void;
    get $static(): typeof Mozel;
    $init(): void;
    get $properties(): Record<string, Property>;
    $startTrackingChanges(): string | undefined;
    $finishTrackingChanges(id?: string): void;
    /**
     * Instantiate a Mozel based on the given class and the data.
     * @param Class
     * @param data
     * @param config
     */
    $create<T extends Mozel>(Class: MozelConstructor<T>, data?: MozelData<T>, config?: MozelConfig<T>): T;
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
    $setProperty(property: Property, lock?: boolean): void;
    $remove(child: PropertyValue, includeReferences?: boolean): void;
    $findParent(predicate: (mozel: Mozel, relation: string) => boolean): Mozel | undefined;
    /**
     * The Mozel's parent.
     */
    get $parent(): null | Mozel;
    /**
     * The Mozel's relation to its parent.
     */
    get $relation(): string | null;
    /**
     * @protected
     * For override. Any properties of the mozel should be defined here.
     */
    $define(): void;
    /**
     * Defines a property to be part of the Mozel's data. Only defined properties will be exported and imported
     * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
     *
     * @param {string} name						The name of the property.
     * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
     * 											Number, String, Alphanumeric, Boolean, (subclass of) Mozel or undefined.
     * @param {PropertyOptions} [options]
     */
    $defineProperty<T extends PropertyType>(name: string, type?: T, options?: PropertyOptions<T>): Property;
    $undefineProperty(name: string): void;
    /**
     * Set value with type checking.
     * @param {string|number} property  The name of the property
     * @param {PropertyInput} value		The value to set on the property
     * @param {boolean} init			If set to true, Mozels may be initialized from objects and arrays, respectively.
     * @param {boolean} merge			If set to true, Mozels will be kept if gid did not change; data will be set instead
     */
    $set(property: string, value: PropertyInput, init?: boolean, merge?: boolean): boolean;
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
    $property(property?: string): Property | undefined | null;
    /**
     * Alias of $property
     */
    $: (property?: string) => Property | undefined | null;
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
     * Notify that a property is about to change. Will set the current value for any relevant _watchers, so they can
     * compare the new value to the old value, and provide the old value to the handler.
     *
     * This just-in-time approach has the slight advantage that we don't have to keep copies of values that will
     * never change.
     *
     * @param {string[]} path		The path at which the change occurred.
     */
    $notifyPropertyBeforeChange(path: string[]): void;
    /**
     * Check with all registered watchers if property can be changed to its new value.
     * @param {string[]} path
     */
    $validatePropertyChange(path: string[]): boolean;
    /**
     * Notify that a property has changed. Will activate relevant _watchers.
     * @param {string[]} path		Path at which the property changed.
     * @param {Mozel} [submozel]	The direct submozel reporting the change.
     */
    $notifyPropertyChanged(path: string[]): void;
    /**
     * Resolves the given reference.
     * @param {{gid:alphanumeric}} ref
     */
    $resolveReference(ref: {
        gid: alphanumeric;
    }): Mozel | undefined;
    /**
     * Resolves all reference Properties
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
        [key: string]: Mozel;
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
     * Clones the Mozel recursively. GIDs will remain the same.
     * A new Factory/Registry will be created to avoid gid conflicts.
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
