import Collection from './Collection';

import {find, includes, isArray, isBoolean, isFunction, isNumber, isPlainObject, isString, isNil, cloneDeep} from 'lodash';

import {isClass, isPrimitive, isAlphanumeric, isSubClass, Class, primitive} from "validation-kit"
import Mozel from "./Mozel";
import {injectable} from "inversify";
import logRoot from "./log";

const log = logRoot.instance("property");

// TYPES

export type MozelClass = typeof Mozel;
export type ComplexValue = Mozel|Collection<any>;
export type ComplexType = MozelClass|Collection<any>;
export type PropertyValue = primitive|ComplexValue|undefined;
export type PropertyInput = PropertyValue|object|any[];
export type PropertyType = MozelClass|Class|Collection<any>|undefined;
export type PrimitiveObject = Record<string,primitive|undefined|null>;

export type PropertyValueFactory = ()=>PropertyValue;
export type PropertyOptions = {default?:PropertyValue|PropertyValueFactory, required?:boolean, reference?:boolean};

/**
 * Placeholder class for runtime Property type definition
 */
export class Alphanumeric {}

// TYPEGUARDS

export function isComplexValue(value: any ): value is ComplexValue {
	return value instanceof Mozel || value instanceof Collection;
}
export function isComplexType(value:any): value is ComplexType {
	return isMozelClass(value) || value instanceof Collection;
}
export function isPropertyValue(value:any): value is PropertyValue {
	return isComplexValue(value) || isPrimitive(value);
}
export function isMozelClass(value:any): value is MozelClass {
	return isSubClass(value, Mozel);
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
	public static AcceptedNonComplexTypes = [Number, String, Alphanumeric, Boolean];

	static checkType(value:any, type?:PropertyType, required=false):value is PropertyValue {
		if(isNil(value) && !required) {
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

	private readonly parent:Mozel;

	constructor(parent:Mozel, name:string, type?:PropertyType, options?:PropertyOptions) {
		if(this.type && !includes(Property.AcceptedNonComplexTypes, this.type) && !isMozelClass(this.type)) {
			log.error("Type argument can be " + Property.AcceptedNonComplexTypes.join(',') + ", (subclass of) Mozel, Collection or undefined. Using default: undefined.");
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
			log.error(`Default for ${this.parent.$name()}.${this.name} expects ${this.getTypeName()}.`, value);
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
			log.error("Property is not a reference. Cannot resolve.");
			return;
		}
		if(this.value === undefined) {
			return; // no error necessary, undefined is fine.
		}
		if(isMozelClass(this.type) && this.value instanceof Mozel) {
			// Replace placeholder mozel with the resolved reference
			let mozel = this.value.$resolveReference();
			if(!mozel) {
				log.error(`No Mozel found with GID ${this.value.gid}`);
			} else if (!this.checkType(mozel)) {
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
		if(this.isReference) {
			return this.resolveReference();
		}
		if(this.value instanceof Mozel) {
			this.value.$resolveReferences();
			return;
		}
		if(this.value instanceof Collection) {
			this.value.resolveReferences();
			return;
		}
	}

	isDefault():boolean {
		// Mozel and Collection pointer can be default but nested properties may have changed
		if(isComplexValue(this._value) && this._value === this._default) {
			return this._value instanceof Mozel ? this._value.$isDefault() : this._value.isDefault();
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

		// Notify watchers before the change, so they can get the old value
		this.notifyBeforeChange();

		// Set value on parent
		this._value = value;
		this._isDefault = false;

		// If Property is not just a reference but part of a hierarchy, set Parent on Mozels and Collections.
		if (!this._reference) {
			if(value instanceof Mozel) {
				value.$setParent(this.parent, this.name);
			}
			if(value instanceof Collection) {
				value.setParent(this.parent);
			}
		}

		// If value is Collection, should listen to changes in Collection
		if(value instanceof Collection) {
			value.beforeAdd((item, batch) => {
				if(batch.index === 0) this.notifyBeforeChange() ;// notify before first
			});
			value.onAdded((item, batch) => {
				if(batch.index >= batch.total-1) this.notifyChange(); // notify after last
			});
			value.beforeRemoved((item, index, batch) => {
				if(batch.index === 0) this.notifyBeforeChange(); // notify before first
			});
			value.onRemoved((item, index, batch) => {
				if(batch.index >= batch.total-1) this.notifyChange(); // notify after last
			});
		}

		this.notifyChange();
	}
	/**
	 * Set value with type checking
	 * @param {PropertyInput} value
	 * @param {boolean} init					If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
	 */
	set(value:PropertyInput, init = false) {
		if(!this.checkType(value)) {
			// Value was not correct but perhaps it is acceptable init data
			if(init && this.tryInit(value)) {
				return true;
			}
			if(this.parent.$strict) {
				return false;
			}
			this.setErrorValue(value);
		}
		// TS: we did the type checking. If the Model is not strict, we allow non-checked types.
		this._set(<PropertyValue>value);
		return true;
	}

	notifyBeforeChange() {
		if(!this.parent) return;
		this.parent.$notifyPropertyBeforeChange([this.name]);
	}

	notifyChange() {
		if(!this.parent) return;
		this.parent.$notifyPropertyChanged([this.name]);
	}

	setErrorValue(value:any) {
		let err = new Error(`${this.parent.$name()}.${this.name} expects ${this.getTypeName()}.`);
		this.error = err;
		log.error(err.message, "Received: ", value);
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
		if(this.value instanceof Mozel) {
			this.value.$applyDefaults();
		}
		this._isDefault = true;
	}

	generateDefaultValue() {
		if(this.type === Collection) {
			throw new Error(`Cannot generate default value for '${this.name}' Collection. Should be set explicitly.`);
		}

		if(isNil(this.type)) return '';

		if(isMozelClass(this.type)) {
			if(this.isReference) {
				throw new Error(`Cannot generate default value for a reference ('${this.name}').`);
			}
			return this.parent.$create(this.type);
		}
		switch(this.type) {
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
	 */
	tryInit(value:any) {
		let current = this.value;

		// Init Collection
		if(this.type === Collection && current instanceof Collection && isArray(value)) {
			const newCollection = new Collection(this.parent, this.name, current.getType());
			newCollection.isReference = current.isReference;
			newCollection.addItems(value, true);
			this._set(newCollection);
			return true;
		}

		// Init Mozel
		if(this.type && isMozelClass(this.type) && isPlainObject(value)) {
			// Create mozel and try to set again, without type check
			let mozel = this.parent.$create(this.type, value, false, this.isReference);
			this._set(mozel);
			return true;
		}

		return false;
	}

	getPathFrom(mozel:Mozel) {
		return [...this.parent.$getPathFrom(mozel), this.name];
	}
}
