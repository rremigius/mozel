import Collection from '@/Collection';
import { Class, primitive } from "validation-kit";
import Model from "@/Model";
export declare type ModelClass = typeof Model;
export declare type ComplexValue = Model | Collection<any>;
export declare type ComplexType = ModelClass | Collection<any>;
export declare type PropertyValue = primitive | Function | ComplexValue | undefined;
export declare type PropertyInput = PropertyValue | object | any[];
export declare type PropertyType = ModelClass | Class | Function | Collection<any> | undefined;
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
export declare function isModelClass(value: any): value is ModelClass;
export declare function isPrimitiveObject(object: any): object is PrimitiveObject;
/**
 * Runtime type-safe property.
 */
export default class Property {
    static AcceptedNonComplexTypes: (FunctionConstructor | StringConstructor | BooleanConstructor | NumberConstructor | typeof Alphanumeric)[];
    static checkType(value: any, type?: PropertyType, required?: boolean): value is PropertyValue;
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
    private readonly parent;
    constructor(parent: Model, name: string, type?: PropertyType, options?: PropertyOptions);
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
    /**
     * Set value without runtime type checking
     * @param {PropertyValue} value
     * @private
     */
    private _set;
    /**
     * Set value with type checking
     * @param {PropertyInput} value
     * @param {boolean} init					If set to true, Models and Collections may be initialized from objects and arrays, respectively.
     */
    set(value: PropertyInput, init?: boolean): boolean;
    notifyChange(newValue: PropertyValue, oldValue: PropertyValue): void;
    setErrorValue(value: any): void;
    applyDefault(): void;
    generateDefaultValue(): false | "" | 0 | Model | (() => void);
    getTypeName(): string;
    /**
     * Try to initialize the value for this property using initialization data. Will only work for Models and Collections
     * with objects or arrays, respectively.
     * @param value
     */
    tryInit(value: any): boolean;
}
