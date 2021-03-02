var Property_1;
import { __decorate } from "tslib";
import Collection from '@/Collection';
import { find, includes, isArray, isBoolean, isFunction, isNumber, isPlainObject, isString, isNil } from 'lodash';
import { isClass, isPrimitive, isAlphanumeric, isSubClass } from "validation-kit";
import Model from "@/Model";
import { injectable } from "inversify";
/**
 * Placeholder class for runtime Property type definition
 */
export class Alphanumeric {
}
// TYPEGUARDS
export function isComplexValue(value) {
    return value instanceof Model || value instanceof Collection;
}
export function isComplexType(value) {
    return isModelClass(value) || value instanceof Collection;
}
export function isPropertyValue(value) {
    return isComplexValue(value) || isPrimitive(value);
}
export function isModelClass(value) {
    return isSubClass(value, Model);
}
export function isPrimitiveObject(object) {
    return isPlainObject(object) && !find(object, (value, key) => {
        return !isPrimitive(value);
    });
}
/**
 * Runtime type-safe property.
 */
let Property = Property_1 = class Property {
    constructor(parent, name, type, options) {
        /**
         * Determines whether the Property is part of a hierarchy, or just a reference.
         * If set to `false`, no parent will be set on its value.
         */
        this._reference = false;
        this._required = false;
        this._isDefault = false;
        if (this.type && !includes(Property_1.AcceptedNonComplexTypes, this.type) && !isModelClass(this.type)) {
            console.error("Type argument can be " + Property_1.AcceptedNonComplexTypes.join(',') + ", (subclass of) Model, Collection or undefined. Using default: undefined.");
            type = undefined;
        }
        this.parent = parent;
        this.name = name;
        this.type = type;
        if (options) {
            this._required = options.required === true;
            this._default = options.default;
            this._reference = options.reference === true;
            if (this._required && this._reference && !this._default) {
                // References cannot be auto-generated so they should not be set to required without default
                const message = `Property '${parent.static.type}.${this.name}' is set as required reference but has no default defined.`;
                throw new Error(message);
            }
        }
    }
    static checkType(value, type, required = false) {
        if (isNil(value) && !required) {
            // All model properties can be undefined if not required
            return true;
        }
        switch (type) {
            case undefined:
                // Any primitive is fine if type is undefined
                return isPrimitive(value);
            case Alphanumeric:
                return isAlphanumeric(value);
            case Number:
                return isNumber(value);
            case String:
                return isString(value);
            case Boolean:
                return isBoolean(value);
            case Function:
                return isFunction(value);
            default:
                // Value should be Model or Collection
                return isModelClass(type) && value instanceof type ||
                    type === Collection && value instanceof Collection;
        }
    }
    get value() {
        return this.get();
    }
    set value(value) {
        this.set(value);
    }
    get default() {
        if (isFunction(this._default)) {
            // Compute the default
            this._default = this._default();
        }
        return this._default;
    }
    set default(value) {
        if (!this.checkType(value)) {
            console.error(`Default for ${this.parent.getModelName()}.${this.name} expects ${this.getTypeName()}.`, value);
            return;
        }
        this._default = value;
    }
    get required() {
        return this._required;
    }
    get isReference() {
        return this._reference;
    }
    /**
     * Attempts to resolve the current value as a reference.
     * Will replace the current value with the result (even if reference was not found!)
     */
    resolveReference() {
        if (!this.isReference) {
            console.error("Property is not a reference. Cannot resolve.");
            return;
        }
        if (this.value === undefined) {
            return; // no error necessary, undefined is fine.
        }
        if (isModelClass(this.type) && this.value instanceof Model) {
            // Replace placeholder model with the resolved reference
            let model = this.value.resolveReference();
            if (!model) {
                console.error(`No Model found with GID ${this.value.gid}`);
            }
            else if (!this.checkType(model)) {
                console.error(`Referenced Model with GID ${this.value.gid} was not a ${this.type.name}.`);
                model = undefined;
            }
            this.set(model);
            return;
        }
        console.error("Property is not of Model type. Cannot resolve reference.");
        return;
    }
    /**
     * Either resolves its own reference if it is marked as one, or resolves all references of its value (only for complex values).
     */
    resolveReferences() {
        if (this.isReference) {
            return this.resolveReference();
        }
        if (!isComplexValue(this.value)) {
            return;
        }
        this.value.resolveReferences();
    }
    isDefault() {
        // Model and Collection pointer can be default but nested properties may have changed
        if (isComplexValue(this._value) && this._value === this._default) {
            return this._value.isDefault();
        }
        return this._value === this._default;
    }
    get() {
        return this._value;
    }
    checkType(value) {
        return Property_1.checkType(value, this.type, this.required);
    }
    /**
     * Set value without runtime type checking
     * @param {PropertyValue} value
     * @private
     */
    _set(value) {
        if (value === this._value)
            return;
        // Set value on parent
        const oldValue = this._value;
        this._value = value;
        this._isDefault = false;
        // If Property is not just a reference but part of a hierarchy, set Parent on Models and Collections.
        if (!this._reference && isComplexValue(value)) {
            value.setParent(this.parent, this.name);
        }
        this.notifyChange(this._value, oldValue);
    }
    /**
     * Set value with type checking
     * @param {PropertyInput} value
     * @param {boolean} init					If set to true, Models and Collections may be initialized from objects and arrays, respectively.
     */
    set(value, init = false) {
        if (!this.checkType(value)) {
            // Value was not correct but perhaps it is acceptable init data
            if (init && this.tryInit(value)) {
                return true;
            }
            this.setErrorValue(value);
            return false;
        }
        this._set(value);
        return true;
    }
    notifyChange(newValue, oldValue) {
        if (!this.parent)
            return;
        this.parent.propertyChanged([this.name], newValue, oldValue);
    }
    setErrorValue(value) {
        let err = new Error(`${this.parent.getModelName()}.${this.name} expects ${this.getTypeName()}.`);
        this.error = err;
        console.error(err.message, "Received: ", value);
    }
    applyDefault() {
        // If value was already defined, don't apply default
        if (this.value !== undefined) {
            return;
        }
        // If Property is required but no default was set, generate one
        if (this.required && isNil(this.default)) {
            this.default = this.generateDefaultValue();
        }
        // No default defined, no default to apply
        if (this.default === undefined) {
            return;
        }
        // Apply
        this.value = this.default;
        if (this.value instanceof Model) {
            this.value.applyDefaults();
        }
        this._isDefault = true;
    }
    generateDefaultValue() {
        if (this.type === Collection) {
            throw new Error(`Cannot generate default value for '${this.name}' Collection. Should be set explicitly.`);
        }
        if (isNil(this.type))
            return '';
        if (isModelClass(this.type)) {
            if (this.isReference) {
                throw new Error(`Cannot generate default value for a reference ('${this.name}').`);
            }
            return this.parent.create(this.type);
        }
        switch (this.type) {
            case Number: return 0;
            case Boolean: return false;
            case Function: return () => { };
            case Alphanumeric:
            case String:
            default: return '';
        }
    }
    getTypeName() {
        return isClass(this.type) ? this.type.name : 'a primitive value';
    }
    /**
     * Try to initialize the value for this property using initialization data. Will only work for Models and Collections
     * with objects or arrays, respectively.
     * @param value
     */
    tryInit(value) {
        let current = this.value;
        // Init collection
        if (this.type === Collection && current instanceof Collection && isArray(value)) {
            current.clear();
            current.addItems(value, true);
            // We're done here (we don't have to overwrite the collection)
            return true;
        }
        // Init Model
        if (this.type && isModelClass(this.type) && isPlainObject(value)) {
            // Create model and try to set again, without type check
            let model = this.parent.create(this.type, value, false, this.isReference);
            this._set(model);
            return true;
        }
        return false;
    }
};
Property.AcceptedNonComplexTypes = [Number, String, Alphanumeric, Boolean, Function];
Property = Property_1 = __decorate([
    injectable()
], Property);
export default Property;
//# sourceMappingURL=Property.js.map