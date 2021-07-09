var Property_1;
import { __decorate } from "tslib";
import Collection, { CollectionBeforeChangeEvent, CollectionChangedEvent } from './Collection';
import { find, includes, isArray, isBoolean, isFunction, isNil, isNumber, isPlainObject, isString } from 'lodash';
import { isAlphanumeric, isClass, isPrimitive, isSubClass } from "validation-kit";
import Mozel from "./Mozel";
import { injectable } from "inversify";
import logRoot from "./log";
const log = logRoot.instance("property");
/**
 * Placeholder class for runtime Property type definition
 */
export class Alphanumeric {
}
// TYPEGUARDS
export function isComplexValue(value) {
    return value instanceof Mozel || value instanceof Collection;
}
export function isComplexType(value) {
    return isMozelClass(value) || value instanceof Collection;
}
export function isPropertyValue(value) {
    return isComplexValue(value) || isPrimitive(value);
}
export function isMozelClass(value) {
    return isSubClass(value, Mozel);
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
        this._collectionBeforeChangeListener = (event) => this.notifyBeforeChange(event.data.index.toString());
        this._collectionChangedListener = (event) => this.notifyChange(event.data.index.toString());
        if (this.type && !includes(Property_1.AcceptedNonComplexTypes, this.type) && !isMozelClass(this.type)) {
            log.error("Type argument can be " + Property_1.AcceptedNonComplexTypes.join(',') + ", (subclass of) Mozel, Collection or undefined. Using default: undefined.");
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
            // All mozel properties can be undefined if not required
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
                // Value should be Mozel or Collection
                return isMozelClass(type) && value instanceof type ||
                    type === Collection && value instanceof Collection;
        }
    }
    static tryParseValue(value, type) {
        if (type === Number) {
            if (isString(value)) {
                const parsed = parseFloat(value);
                if (!isNaN(parsed))
                    return parsed;
            }
            if (isBoolean(value))
                return value ? 1 : 0;
        }
        if (type === String) {
            if (isNumber(value))
                return value.toString();
            if (isBoolean(value))
                return value ? "true" : "false";
        }
        if (type === Boolean) {
            if (isNumber(value)) {
                if (value === 1)
                    return true;
                if (value === 0)
                    return false;
            }
            if (isString(value)) {
                if (value === "true")
                    return true;
                if (value === "false")
                    return false;
            }
        }
        return value;
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
            log.error(`Default for ${this.parent.static.type}.${this.name} expects a ${this.getTypeName()}.`, value);
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
            log.error("Property is not a reference. Cannot resolve.");
            return;
        }
        if (this.value === undefined) {
            return; // no error necessary, undefined is fine.
        }
        if (isMozelClass(this.type) && this.value instanceof Mozel) {
            // Replace placeholder mozel with the resolved reference
            let mozel = this.value.$resolveReference();
            if (!mozel) {
                log.error(`No Mozel found with GID ${this.value.gid}`);
            }
            else if (!this.checkType(mozel)) {
                log.error(`Referenced Mozel with GID ${this.value.gid} was not a ${this.type.name}.`);
                mozel = undefined;
            }
            this.set(mozel);
            return;
        }
        log.error("Property is not of Mozel type. Cannot resolve reference.");
        return;
    }
    /**
     * Either resolves its own reference if it is marked as one, or resolves all references of its value (only for complex values).
     */
    resolveReferences() {
        if (this.isReference) {
            return this.resolveReference();
        }
        if (this.value instanceof Mozel) {
            this.value.$resolveReferences();
            return;
        }
        if (this.value instanceof Collection) {
            this.value.resolveReferences();
            return;
        }
    }
    isDefault() {
        // Mozel and Collection pointer can be default but nested properties may have changed
        if (isComplexValue(this._value) && this._value === this._default) {
            return this._value instanceof Mozel ? this._value.$isDefault() : this._value.isDefault();
        }
        return this._value === this._default;
    }
    get() {
        return this._value;
    }
    checkType(value) {
        return Property_1.checkType(value, this.type, this.required);
    }
    isPrimitiveType() {
        return !this.isMozelType() && !this.isCollectionType();
    }
    isMozelType() {
        return isMozelClass(this.type);
    }
    isCollectionType(Type) {
        if (this.type !== Collection)
            return false;
        if (!Type)
            return true;
        const collection = this.value;
        if (collection.getType() === Type)
            return true;
        return isSubClass(collection.getType(), Type);
    }
    /**
     * Set value without runtime type checking
     * @param {PropertyValue} value
     * @private
     */
    _set(value) {
        if (value === this._value)
            return;
        if (this._value instanceof Collection) {
            log.error("Collections cannot be replaced.");
            return;
        }
        // Notify watchers before the change, so they can get the old value
        this.notifyBeforeChange();
        // Stop listening to current collection
        if (this._value instanceof Collection) {
            this._value.off(CollectionChangedEvent, this._collectionChangedListener);
            this._value.off(CollectionBeforeChangeEvent, this._collectionBeforeChangeListener);
        }
        // Set value on parent
        this._value = value;
        this._isDefault = false;
        // If Property is not just a reference but part of a hierarchy, set Parent on Mozels and Collections.
        if (!this._reference) {
            if (value instanceof Mozel) {
                value.$setParent(this.parent, this.name);
            }
            if (value instanceof Collection) {
                value.setParent(this.parent);
            }
        }
        // If value is Collection, should listen to changes in Collection
        if (value instanceof Collection) {
            value.on(CollectionChangedEvent, this._collectionChangedListener);
            value.on(CollectionBeforeChangeEvent, this._collectionBeforeChangeListener);
        }
        this.notifyChange();
    }
    /**
     * Set value with type checking
     * @param {PropertyInput} value
     * @param {boolean} init			If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
     * @param {boolean} merge			If set to true, will set data to existing mozels rather than creating new ones.
     */
    set(value, init = false, merge = false) {
        if (!this.checkType(value)) {
            // Value was not correct but perhaps it is acceptable init data
            if (init && this.tryInit(value, merge)) {
                return true;
            }
            if (this.parent.$strict) {
                return false;
            }
            this.setErrorValue(value);
        }
        // TS: we did the type checking. If the Model is not strict, we allow non-checked types.
        this._set(value);
        return true;
    }
    notifyBeforeChange(path) {
        if (!this.parent)
            return;
        const name = path ? `${this.name}.${path}` : this.name;
        this.parent.$notifyPropertyBeforeChange([name]);
    }
    notifyChange(path) {
        if (!this.parent)
            return;
        const name = path ? `${this.name}.${path}` : this.name;
        this.parent.$notifyPropertyChanged([name]);
    }
    setErrorValue(value) {
        let err = new Error(`Must be a ${this.getTypeName()}.`);
        this.error = err;
        log.error(err.message, "Received: ", value);
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
        if (this.value instanceof Mozel) {
            this.value.$applyDefaults();
        }
        this._isDefault = true;
    }
    generateDefaultValue() {
        if (this.type === Collection) {
            throw new Error(`Cannot generate default value for '${this.name}' Collection. Should be set explicitly.`);
        }
        if (isNil(this.type))
            return '';
        if (isMozelClass(this.type)) {
            if (this.isReference) {
                throw new Error(`Cannot generate default value for a reference ('${this.name}').`);
            }
            return this.parent.$create(this.type);
        }
        switch (this.type) {
            case Number: return 0;
            case Boolean: return false;
            case Alphanumeric:
            case String:
            default: return '';
        }
    }
    getTypeName() {
        return isClass(this.type) ? this.type.name : 'a primitive value';
    }
    /**
     * Try to initialize the value for this property using initialization data. Will only work for Mozels and Collections
     * with objects or arrays, respectively.
     * @param value
     * @param merge
     */
    tryInit(value, merge = false) {
        let current = this.value;
        // Init Collection
        if (this.type === Collection && current instanceof Collection && isArray(value)) {
            current.setData(value, true, merge);
            return true;
        }
        // Init Mozel
        if (this.type && isMozelClass(this.type) && isPlainObject(value)) {
            if (this.isReference && current instanceof Mozel && value.gid === current.gid)
                return true; // nothing to do
            if (current instanceof Mozel && (value.gid === current.gid // new data has same gid
                || (merge && !value.gid)) // or new data has no gid and we merge
            ) {
                // Same Mozel, different data
                current.$setData(value, merge);
            }
            else {
                // Create mozel and try to set again, without type check
                let mozel = this.parent.$create(this.type, value, this.isReference);
                this._set(mozel);
            }
            return true;
        }
        // Parse primitives
        if (this.type && this.isPrimitiveType() && isPrimitive(value)) {
            value = this.tryParseValue(value);
            if (this.checkType(value)) {
                this._set(value);
                return true;
            }
        }
        return false;
    }
    tryParseValue(value) {
        return Property_1.tryParseValue(value, this.type);
    }
    getPathFrom(mozel) {
        return [...this.parent.$getPathArrayFrom(mozel), this.name].join('.');
    }
};
Property.AcceptedNonComplexTypes = [Number, String, Alphanumeric, Boolean];
Property = Property_1 = __decorate([
    injectable()
], Property);
export default Property;
//# sourceMappingURL=Property.js.map