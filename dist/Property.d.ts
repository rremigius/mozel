import Collection from './Collection';
import { Class, primitive } from "validation-kit";
import Mozel from "./Mozel";
export declare type MozelClass = typeof Mozel;
export declare type ComplexValue = Mozel | Collection<any>;
export declare type ComplexType = MozelClass | Collection<any>;
export declare type PropertyValue = primitive | ComplexValue | undefined;
export declare type PropertyInput = PropertyValue | object | any[];
export declare type PropertyType = MozelClass | Class | Collection<any> | undefined;
export declare type PrimitiveObject = Record<string, primitive | undefined | null>;
export declare type PropertyValueFactory = () => PropertyValue;
export declare type PropertyOptions = {
    default?: PropertyValue | PropertyValueFactory;
    required?: boolean;
    reference?: boolean;
};
/**
 * Placeholder class for runtime Property type definition
 */
export declare class Alphanumeric {
}
export declare function isComplexValue(value: any): value is ComplexValue;
export declare function isComplexType(value: any): value is ComplexType;
export declare function isPropertyValue(value: any): value is PropertyValue;
export declare function isMozelClass(value: any): value is MozelClass;
export declare function isPrimitiveObject(object: any): object is PrimitiveObject;
/**
 * Runtime type-safe property.
 */
export default class Property {
    static AcceptedNonComplexTypes: (StringConstructor | BooleanConstructor | NumberConstructor | typeof Alphanumeric)[];
    static checkType(value: any, type?: PropertyType, required?: boolean): value is PropertyValue;
    static tryParseValue(value: unknown, type: PropertyType): unknown;
    name: string;
    type?: PropertyType;
    error?: Error;
    /**
     * Determines whether the Property is part of a hierarchy, or just a reference.
     * If set to `false`, no parent will be set on its value.
     */
    private readonly _reference;
    private readonly _required;
    private _default?;
    private _value;
    private _isDefault;
    private _collectionBeforeChangeListener;
    private _collectionChangedListener;
    private readonly parent;
    constructor(parent: Mozel, name: string, type?: PropertyType, options?: PropertyOptions);
    get value(): PropertyValue;
    set value(value: PropertyValue);
    get default(): PropertyValue;
    set default(value: PropertyValue);
    get required(): boolean;
    get isReference(): boolean;
    /**
     * Attempts to resolve the current value as a reference.
     * Will replace the current value with the result (even if reference was not found!)
     */
    resolveReference(): void;
    /**
     * Either resolves its own reference if it is marked as one, or resolves all references of its value (only for complex values).
     */
    resolveReferences(): void;
    isDefault(): boolean;
    get(): PropertyValue;
    checkType(value: any): value is PropertyValue;
    isPrimitiveType(): boolean;
    isMozelType(): boolean;
    isCollectionType(Type?: PropertyType): boolean;
    /**
     * Set value without runtime type checking
     * @param {PropertyValue} value
     * @private
     */
    private _set;
    /**
     * Set value with type checking
     * @param {PropertyInput} value
     * @param {boolean} init			If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
     * @param {boolean} merge			If set to true, will set data to existing mozels rather than creating new ones.
     */
    set(value: PropertyInput, init?: boolean, merge?: boolean): boolean;
    notifyBeforeChange(path?: string): void;
    notifyChange(path?: string): void;
    setErrorValue(value: any): void;
    applyDefault(): void;
    generateDefaultValue(): false | "" | 0 | Mozel;
    getTypeName(): string;
    /**
     * Try to initialize the value for this property using initialization data. Will only work for Mozels and Collections
     * with objects or arrays, respectively.
     * @param value
     * @param merge
     */
    tryInit(value: any, merge?: boolean): boolean;
    tryParseValue(value: unknown): unknown;
    getPathFrom(mozel: Mozel): string;
}
