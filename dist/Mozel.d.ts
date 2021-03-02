import "reflect-metadata";
import Property, { Alphanumeric, ComplexValue, ModelClass, PropertyInput, PropertyOptions, PropertyType, PropertyValue } from './Property';
import Collection, { CollectionOptions, CollectionType } from './Collection';
import Templater from '@/Templater';
import { injectableModel } from "@/inversify";
import ModelFactoryInterface from "@/MozelFactoryInterface";
import Registry from "@/Registry";
import { alphanumeric, primitive } from 'validation-kit';
export declare type Data = {
    [key: string]: any;
};
export declare type MozelConstructor<T extends Mozel> = {
    new (...args: any[]): T;
    type: string;
};
export declare type PropertyWatcher<T extends PropertyValue> = {
    path: string;
    type?: PropertyType;
    immediate?: boolean;
    deep?: boolean;
    currentValue?: T;
    handler: (newValue: T, oldValue: T) => void;
};
export declare type PropertyKeys<T extends Mozel> = {
    [K in keyof T]: T[K] extends PropertyValue ? K : never;
}[keyof T];
export declare type CollectionData<T> = T extends Mozel ? MozelData<T>[] : T extends primitive ? T[] | Collection<T> : never;
export declare type PropertyData<T> = T extends PropertyValue ? T extends Mozel ? MozelData<T> : T extends Collection<infer C> ? CollectionData<C> : T : false;
export declare type MozelData<T extends Mozel> = T extends {
    ModelDataType: any;
} ? T['ModelDataType'] : {
    [K in PropertyKeys<T>]?: PropertyData<T[K]>;
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
export { Alphanumeric, alphanumeric, ModelClass };
export { injectableModel };
export declare function isData(value: any): value is Data;
/**
 * PROPERTY decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param {object} options
 */
export declare function property(runtimeType?: PropertyType, options?: PropertyOptions): (target: Mozel, propertyName: string) => void;
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
export declare const reference = true;
/**
 * Model class providing runtime type checking and can be exported and imported to and from plain objects.
 */
export default class Mozel {
    _type?: string;
    static get type(): string;
    private static _classPropertyDefinitions;
    private static _classCollectionDefinitions;
    private readonly modelFactory?;
    private readonly registry?;
    private properties;
    private parent;
    private parentLock;
    private relation;
    private readonly watchers;
    id?: alphanumeric;
    gid: alphanumeric;
    isReference: boolean;
    /**
     * Define a property for the model.
     * @param {string} name					Name of the property
     * @param {PropertyType} [runtimeType]	Type to check at runtime
     * @param {PropertyOptions} [options]
     */
    static property(name: string, runtimeType?: PropertyType, options?: PropertyOptions): void;
    static defineClassProperty(name: string, runtimeType?: PropertyType, options?: PropertyOptions): void;
    /**
     * Define a collection for the model.
     * @param {string} name					Name of the collection
     * @param {CollectionType} runtimeType	Type to check on the items in the collection
     * @param {CollectionOptions} options
     */
    static collection(name: string, runtimeType?: CollectionType, options?: CollectionOptions): void;
    static defineClassCollection(name: string, runtimeType?: CollectionType, options?: CollectionOptions): void;
    /**
     * Instantiate a Model based on raw data.
     * @param {Data} [data]
     */
    static create<T extends Mozel>(data?: MozelData<T>): T;
    static getParentClass(): any;
    /**
     * Definitions of Properties made at class level.
     */
    protected static get classPropertyDefinitions(): PropertyDefinition[];
    /**
     * Definitions of Collections made at class level.
     */
    protected static get classCollectionDefinitions(): CollectionDefinition[];
    constructor(modelFactory?: ModelFactoryInterface, registry?: Registry<Mozel>);
    get static(): typeof Mozel;
    init(): void;
    /**
     * Instantiate a Model based on the given class and the data.
     * @param Class
     * @param data
     * @param root					If true, references will be resolved after creation.
     * @param asReference		If true, will not be registered.
     */
    create(Class: ModelClass, data?: Data, root?: boolean, asReference?: boolean): Mozel;
    destroy(): void;
    /**
     * Set the Model's parent Model.
     * @param {Mozel} parent			The parent this Model is a child of.
     * @param {string} relation			The name of the parent-child relationship.
     * @param {boolean} lock			Locks the Model to the parent, so it cannot be transferred to another parent.
     */
    setParent(parent: Mozel, relation: string, lock?: boolean): void;
    /**
     * Get the Model's parent.
     */
    getParent(): Mozel | null;
    /**
     * Get the Model's relation to its parent.
     */
    getRelation(): string | null;
    /**
     * @protected
     * For override. Any properties and collections of the model should be defined here.
     */
    define(): void;
    /**
     * Defines a property to be part of the Model's data. Only defined properties will be exported and imported
     * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
     *
     * @param {string} name							The name of the property.
     * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
     * 																	Number, String, Alphanumeric, Boolean, (subclass of) Model, Collection or undefined.
     * @param {PropertyOptions} [options]
     */
    defineProperty(name: string, type?: PropertyType, options?: PropertyOptions): Property;
    /**
     * Defines a property and instantiates it as a Collection.
     * @param {string} relation       				The relation name.
     * @param {Mozel} [type]       						The class of the items in the Collection.
     * @param {CollectionOptions} [options]
     * @return {Collection}
     */
    defineCollection(relation: string, type?: CollectionType, options?: CollectionOptions): Collection<primitive | Mozel>;
    /**
     * Set value with type checking.
     * @param {string} property				The name of the property
     * @param {PropertyInput} value		The value to set on the property
     * @param {boolean} init					If set to true, Models and Collections may be initialized from objects and arrays, respectively.
     */
    set(property: string, value: PropertyInput, init?: boolean): boolean;
    /**
     * Get type-safe value of the given property.
     * @param {string} property
     */
    get(property: string): PropertyValue;
    /**
     * Get the Property object with the given name.
     * @param property
     */
    getProperty(property: string): Property;
    /**
     * Sets all registered properties from the given data.
     * @param {object} data			The data to set into the model.
     * @param {boolean} [init]	If set to true, Models and Collections can be initialized from objects and arrays.
     */
    setData(data: Data, init?: boolean): void;
    watch(watcher: PropertyWatcher<PropertyValue>): void;
    private static callWatcherHandler;
    propertyChanged(path: string[], newValue: PropertyValue, oldValue: PropertyValue): void;
    /**
     * Resolves the given reference, or its own if no data is provided and it's marked as one.
     * @param ref
     */
    resolveReference<Model>(ref?: {
        gid: alphanumeric;
    }): Mozel | undefined;
    /**
     * Resolves all reference Properties and Collections
     */
    resolveReferences(): void;
    applyDefaults(): void;
    isDefault(): boolean;
    /**
     * Set only primitive properties from given data.
     * @param {Data} properties
     */
    setPrimitiveProperties(properties: Data): void;
    /**
     * Checks if the Model has a property
     * @param property
     */
    hasProperty(property: string): boolean;
    /**
     * Get only primitive type properties.
     * @return {[key:string]:Primitive}
     */
    getPrimitiveProperties(): {
        [key: string]: primitive;
    };
    /**
     * Get only complex type properties.
     * @return {[key:string]:ComplexValue}
     */
    getComplexProperties(): {
        [key: string]: ComplexValue;
    };
    /**
     * Check if the given property is a primitive.
     * @param key
     */
    isPrimitiveProperty(key: string): boolean;
    /**
     * Export defined properties to a plain (nested) object.
     * @return {Data}
     */
    export(): Data;
    /**
     * Renders string templates in all properties of the Model, recursively.
     * @param {Templater|object} templater	A Templater to use to render the templates, or a data object to fill in the values.
     * 																			If a data object is provided, a new Templater will be instantiated with that data object.
     */
    renderTemplates(templater: Templater | Data): void;
    getModelName(): string;
    getModelPlural(): string;
    getURIPart(): string;
}
