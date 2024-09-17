import { alphanumeric, Class, primitive } from "validation-kit";
import Mozel, { MozelConfig } from "./Mozel";
export type MozelClass = typeof Mozel;
export type ComplexValue = Mozel;
export type ComplexType = MozelClass;
export type PropertyValue = primitive | ComplexValue | undefined;
export type PropertyInput = PropertyValue | object | any[];
export type PrimitiveClass = Alphanumeric | StringConstructor | NumberConstructor | BooleanConstructor;
export type PropertyType = MozelClass | PrimitiveClass | FunctionConstructor | undefined;
export type PrimitiveObject = Record<string, primitive | undefined | null>;
export type Reference = {
    gid: alphanumeric;
};
export type PropertyInputFactory = () => PropertyInput;
export type InitArgument<T> = T extends Class ? InstanceType<T> : T;
export type PropertyOptions<T> = {
    default?: PropertyInput | PropertyInputFactory;
    required?: boolean;
    reference?: boolean;
    typeOptions?: T extends Mozel ? MozelConfig<T> : unknown;
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
    options?: PropertyOptions<unknown>;
    /**
     * Determines whether the Property is part of a hierarchy, or just a reference.
     * If set to `false`, no parent will be set on its value.
     */
    private readonly _reference;
    private _ref?;
    private readonly _required;
    private readonly _default?;
    private _value;
    private _isDefault;
    private _mozelConfig;
    private _mozelDestroyedListener;
    private readonly parent;
    constructor(parent: Mozel, name: string, type?: PropertyType, options?: PropertyOptions<unknown>);
    get value(): PropertyValue;
    set value(value: PropertyValue);
    get ref(): Reference | null | undefined;
    get default(): PropertyInput | PropertyInputFactory;
    get required(): boolean;
    get isReference(): boolean;
    getParent(): Mozel;
    /**
     * Get original options of the Property
     */
    getOptions(): PropertyOptions<unknown> | undefined;
    /**
     * Attempts to resolve the current reference GID to a value.
     * Will replace the current value with the result (even if reference was not found!)
     */
    resolveReference(): void;
    /**
     * Either resolves its own reference if it is marked as one, or resolves all references of its value (only for complex values).
     */
    resolveReferences(): void;
    isDefault(): boolean;
    get(resolveReference?: boolean): PropertyValue;
    checkType(value: any): value is PropertyValue;
    isPrimitiveType(): boolean;
    isMozelType(): boolean;
    /**
     * Set value without runtime type checking
     * @param {PropertyValue} value
     * @private
     */
    private _set;
    /**
     * Set value with type checking
     * @param {PropertyInput} value
     * @param {boolean} init			If set to true, Mozels may be initialized from objects and arrays, respectively.
     * @param {boolean} merge			If set to true, will set data to existing mozels rather than creating new ones.
     */
    set(value: PropertyInput, init?: boolean, merge?: boolean): boolean;
    notifyBeforeChange(path?: alphanumeric): void;
    validateChange(path?: alphanumeric): boolean | undefined;
    notifyChange(path?: alphanumeric): void;
    setErrorValue(value: any): void;
    applyDefault(): void;
    generateDefaultValue(): PropertyValue;
    getTypeName(): string;
    /**
     * Try to initialize the value for this property using initialization data.
     * @param value
     * @param merge
     */
    tryInit(value: any, merge?: boolean): boolean;
    tryParseValue(value: unknown): unknown;
    getPathFrom(mozel: Mozel): string;
}
