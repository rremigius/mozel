import Collection from '@/Collection';

import {find, includes, isArray, isBoolean, isFunction, isNumber, isPlainObject, isString, isNil} from 'lodash';

import {isClass, isPrimitive, isAlphanumeric, isSubClass, Class, primitive} from "validation-kit"
import Model from "@/Model";
import {injectable} from "inversify";

// TYPES

export type ModelClass = typeof Model;
export type ComplexValue = Model|Collection<any>;
export type ComplexType = ModelClass|Collection<any>;
export type PropertyValue = primitive|Function|ComplexValue|undefined;
export type PropertyInput = PropertyValue|object|any[];
export type PropertyType = ModelClass|Class|Function|Collection<any>|undefined;
export type PrimitiveObject = Record<string,primitive|undefined|null>;

export type PropertyValueFactory = ()=>PropertyValue;
export type PropertyOptions = {default?:PropertyValue|PropertyValueFactory, required?:boolean, reference?:boolean};

/**
 * Placeholder class for runtime Property type definition
 */
export class Alphanumeric {}

// TYPEGUARDS

export function isComplexValue(value: any ): value is ComplexValue {
	return value instanceof Model || value instanceof Collection;
}
export function isComplexType(value:any): value is ComplexType {
	return isModelClass(value) || value instanceof Collection;
}
export function isPropertyValue(value:any): value is PropertyValue {
	return isComplexValue(value) || isPrimitive(value);
}
export function isModelClass(value:any): value is ModelClass {
	return isSubClass(value, Model);
}
export function isPrimitiveObject(object:any): object is PrimitiveObject {
	return isPlainObject(object) && !find(object, (value:any, key:string) => {
		return !isPrimitive(value);
	});
}

/**
 * Runtime type-safe property.
 */
@injectable()
export default class Property {
	public static AcceptedNonComplexTypes = [Number, String, Alphanumeric, Boolean, Function];

	static checkType(value:any, type?:PropertyType, required=false):value is PropertyValue {
		if(isNil(value) && !required) {
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

	name:string;
	type?:PropertyType;
	error?:Error;

	/**
	 * Determines whether the Property is part of a hierarchy, or just a reference.
	 * If set to `false`, no parent will be set on its value.
	 */
	private readonly _reference:boolean = false;
	private readonly _required:boolean = false;
	private _default?:PropertyValue|PropertyValueFactory;
	private _value:PropertyValue;
	private _isDefault = false;

	private readonly parent:Model;

	constructor(parent:Model, name:string, type?:PropertyType, options?:PropertyOptions) {
		if(this.type && !includes(Property.AcceptedNonComplexTypes, this.type) && !isModelClass(this.type)) {
			console.error("Type argument can be " + Property.AcceptedNonComplexTypes.join(',') + ", (subclass of) Model, Collection or undefined. Using default: undefined.");
			type = undefined;
		}
		this.parent = parent;
		this.name = name;
		this.type = type;

		if(options) {
			this._required = options.required === true;
			this._default = options.default;
			this._reference = options.reference === true;

			if(this._required && this._reference && !this._default) {
				// References cannot be auto-generated so they should not be set to required without default
				const message = `Property '${parent.static.type}.${this.name}' is set as required reference but has no default defined.`;
				throw new Error(message);
			}
		}
	}

	get value():PropertyValue {
		return this.get();
	}
	set value(value:PropertyValue) {
		this.set(value);
	}

	get default():PropertyValue {
		if(isFunction(this._default)) {
			// Compute the default
			this._default = this._default();
		}
		return this._default;
	}

	set default(value:PropertyValue) {
		if(!this.checkType(value)) {
			console.error(`Default for ${this.parent.getModelName()}.${this.name} expects ${this.getTypeName()}.`, value);
			return;
		}
		this._default = value;
	}

	get required():boolean {
		return this._required;
	}

	get isReference():boolean {
		return this._reference;
	}

	/**
	 * Attempts to resolve the current value as a reference.
	 * Will replace the current value with the result (even if reference was not found!)
	 */
	resolveReference() {
		if(!this.isReference) {
			console.error("Property is not a reference. Cannot resolve.");
			return;
		}
		if(this.value === undefined) {
			return; // no error necessary, undefined is fine.
		}
		if(isModelClass(this.type) && this.value instanceof Model) {
			// Replace placeholder model with the resolved reference
			let model = this.value.resolveReference();
			if(!model) {
				console.error(`No Model found with GID ${this.value.gid}`);
			} else if (!this.checkType(model)) {
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
		if(this.isReference) {
			return this.resolveReference();
		}
		if(!isComplexValue(this.value)) {
			return;
		}
		this.value.resolveReferences();
	}

	isDefault():boolean {
		// Model and Collection pointer can be default but nested properties may have changed
		if(isComplexValue(this._value) && this._value === this._default) {
			return this._value.isDefault();
		}
		return this._value === this._default;
	}

	get() {
		return this._value;
	}

	checkType(value:any):value is PropertyValue {
		return Property.checkType(value, this.type, this.required);
	}

	/**
	 * Set value without runtime type checking
	 * @param {PropertyValue} value
	 * @private
	 */
	private _set(value:PropertyValue) {
		if(value === this._value) return;

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
	set(value:PropertyInput, init = false) {
		if(!this.checkType(value)) {
			// Value was not correct but perhaps it is acceptable init data
			if(init && this.tryInit(value)) {
				return true;
			}
			this.setErrorValue(value);
			return false;
		}
		this._set(value);
		return true;
	}

	notifyChange(newValue:PropertyValue, oldValue:PropertyValue) {
		if(!this.parent) return;
		this.parent.propertyChanged([this.name], newValue, oldValue);
	}

	setErrorValue(value:any) {
		let err = new Error(`${this.parent.getModelName()}.${this.name} expects ${this.getTypeName()}.`);
		this.error = err;
		console.error(err.message, "Received: ", value);
	}

	applyDefault() {
		// If value was already defined, don't apply default
		if(this.value !== undefined) {
			return;
		}
		// If Property is required but no default was set, generate one
		if(this.required && isNil(this.default)) {
			this.default = this.generateDefaultValue();
		}
		// No default defined, no default to apply
		if(this.default === undefined) {
			return;
		}
		// Apply
		this.value = this.default;
		if(this.value instanceof Model) {
			this.value.applyDefaults();
		}
		this._isDefault = true;
	}

	generateDefaultValue() {
		if(this.type === Collection) {
			throw new Error(`Cannot generate default value for '${this.name}' Collection. Should be set explicitly.`);
		}

		if(isNil(this.type)) return '';

		if(isModelClass(this.type)) {
			if(this.isReference) {
				throw new Error(`Cannot generate default value for a reference ('${this.name}').`);
			}
			return this.parent.create(this.type);
		}
		switch(this.type) {
		case Number: return 0;
		case Boolean: return false;
		case Function: return ()=>{};
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
	tryInit(value:any) {
		let current = this.value;
		// Init collection
		if(this.type === Collection && current instanceof Collection && isArray(value)) {
			current.clear();
			current.addItems(value, true);

			// We're done here (we don't have to overwrite the collection)
			return true;
		}
		// Init Model
		if(this.type && isModelClass(this.type) && isPlainObject(value)) {
			// Create model and try to set again, without type check
			let model = this.parent.create(this.type, value, false, this.isReference);
				this._set(model);
				return true;
			}

		return false;
	}
}
