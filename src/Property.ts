import Collection, {CollectionBeforeChangeEvent, CollectionChangedEvent} from './Collection';

import {find, includes, isArray, isBoolean, isFunction, isNil, isNumber, isPlainObject, isString} from 'lodash';

import {
	alphanumeric,
	Class,
	isAlphanumeric,
	isClass,
	isPrimitive,
	isSubClass,
	primitive,
	safeParseNumber
} from "validation-kit"
import Mozel, {DestroyedEvent} from "./Mozel";
import {injectable} from "inversify";
import logRoot from "./log";
import {get} from "./utils";
import {callback} from "event-interface-mixin";

const log = logRoot.instance("property");

// TYPES

export type MozelClass = typeof Mozel;
export type ComplexValue = Mozel|Collection<any>;
export type ComplexType = MozelClass|Collection<any>;
export type PropertyValue = primitive|ComplexValue|undefined;
export type PropertyInput = PropertyValue|object|any[];
export type PropertyType = MozelClass|Class|Collection<any>|undefined;
export type PrimitiveObject = Record<string,primitive|undefined|null>;
export type Reference = {gid: alphanumeric};

export type PropertyInputFactory = ()=>PropertyInput;
export type PropertyOptions = {default?:PropertyInput|PropertyInputFactory, required?:boolean, reference?:boolean};

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

	static tryParseValue(value:unknown, type:PropertyType) {
		if(type === Number) {
			if(isString(value)) {
				const parsed = parseFloat(value);
				if(!isNaN(parsed)) return parsed;
			}
			if(isBoolean(value)) return value ? 1 : 0;
		}
		if(type === String) {
			if(isNumber(value)) return value.toString();
			if(isBoolean(value)) return value ? "true" : "false";
		}
		if(type === Boolean) {
			if(isNumber(value)) {
				if(value === 1) return true;
				if(value === 0) return false;
			}
			if(isString(value)) {
				if(value === "true") return true;
				if(value === "false") return false;
			}
		}
		return value;
	}

	name:string;
	type?:PropertyType;
	error?:Error;

	/**
	 * Determines whether the Property is part of a hierarchy, or just a reference.
	 * If set to `false`, no parent will be set on its value.
	 */
	private readonly _reference:boolean = false;
	private _ref?:Reference|null = null; // null means no reference to be resolved
	private readonly _required:boolean = false;
	private readonly _default?:PropertyInput|PropertyInputFactory;
	private _value:PropertyValue;
	private _isDefault = false;
	private _registryReferenceListener?:callback<any>;

	private _collectionBeforeChangeListener = (event:CollectionBeforeChangeEvent<any>) => this.notifyBeforeChange(event.index.toString());
	private _collectionChangedListener = (event:CollectionChangedEvent<any>) => this.notifyChange(event.index.toString());

	private _mozelDestroyedListener = (event:DestroyedEvent) => this.set(undefined);

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

	get ref() {
		return this._ref;
	}

	get default():PropertyInput|PropertyInputFactory {
		return this._default;
	}

	get required():boolean {
		return this._required;
	}

	get isReference():boolean {
		return this._reference;
	}

	/**
	 * Attempts to resolve the current reference GID to a value.
	 * Will replace the current value with the result (even if reference was not found!)
	 */
	resolveReference() {
		if(!this.isReference) {
			throw new Error("Property is not a reference. Cannot resolve.");
		}
		if(!isMozelClass(this.type)) {
			throw new Error("Property is not of Mozel type. Cannot resolve reference.");
		}

		// Reference set to undefined: value should be undefined
		if(this._ref === undefined) {
			this.set(undefined);
			return;
		}
		// No reference to resolve, nothing to do.
		if(!this._ref) return;

		// Reference is the same as the current Mozel in value
		if(this._value instanceof Mozel && this._value.gid === this._ref.gid) {
			this._ref = null;
			return; // nothing
		}

		// Replace placeholder mozel with the resolved reference
		let mozel = this.parent.$resolveReference(this._ref);
		if(!mozel){
			return;
		} else if (!this.checkType(mozel)) {
			log.error(`Referenced Mozel with GID ${this._ref.gid} was not a ${this.type.name}.`);
			mozel = undefined;
		}
		this.set(mozel);
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

	get(resolveReference = true) {
		if(this.isReference && resolveReference) {
			this.resolveReference();
		}
		return this._value;
	}

	checkType(value:any):value is PropertyValue {
		return Property.checkType(value, this.type, this.required);
	}

	isPrimitiveType() {
		return !this.isMozelType() && !this.isCollectionType();
	}

	isMozelType() {
		return isMozelClass(this.type);
	}

	isCollectionType(Type?:PropertyType) {
		if(this.type !== Collection) return false;
		if(!Type) return true;

		const collection = this.value as Collection<any>;
		if(collection.getType() === Type) return true;

		return isSubClass(collection.getType(), Type as Class);
	}

	/**
	 * Set value without runtime type checking
	 * @param {PropertyValue} value
	 * @private
	 */
	private _set(value:PropertyValue) {
		if(value === this._value) return;
		if(this._value instanceof Collection) {
			// If we do replace Collections, we need to consider all the event listeners attached to it
			log.error("Collections cannot be replaced.");
			return;
		}

		let detach:Mozel|undefined;
		if(this._value instanceof Mozel && !this.isReference) {
			detach = this._value; // keep for later
			this._value.$events.destroyed.off(this._mozelDestroyedListener);
		}

		// Notify watchers before the change, so they can get the old value
		this.notifyBeforeChange();

		// Set value on parent
		this._value = value;
		this._isDefault = false;

		// Detach after value has been set, to avoid infinite loop between parent.$remove and mozel.$detach.
		if(detach) detach.$detach();

		// If Property is not just a reference but part of a hierarchy, set Parent on Mozels and Collections.
		if (!this.isReference) {
			if(value instanceof Mozel) {
				value.$setParent(this.parent, this.name);
			}
			if(value instanceof Collection) {
				value.setParent(this.parent);
			}
		}

		// New value is Mozel or Collection, listen to changes
		if(value instanceof Collection) {
			value.events.beforeChange.on(this._collectionBeforeChangeListener);
			value.events.changed.on(this._collectionChangedListener);
		} else if (value instanceof Mozel) {
			value.$events.destroyed.on(this._mozelDestroyedListener);
		}

		this.notifyChange();
	}
	/**
	 * Set value with type checking
	 * @param {PropertyInput} value
	 * @param {boolean} init			If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
	 * @param {boolean} merge			If set to true, will set data to existing mozels rather than creating new ones.
	 */
	set(value:PropertyInput, init = false, merge = false) {
		if(!this.checkType(value)) {
			// Value was not correct but perhaps it is acceptable init data
			if(init && this.tryInit(value, merge)) {
				return true;
			}
			if(this.parent.$strict) {
				return false;
			}
			this.setErrorValue(value);
		}
		// TS: we did the type checking. If the Model is not strict, we allow non-checked types.
		this._set(<PropertyValue>value);

		if(this.isReference) {
			if(value instanceof Mozel) {
				this._ref = null;
			} else {
				const gid = get(value, 'gid');
				this._ref = gid ? {gid} : undefined;
			}
		}
		return value;
	}

	notifyBeforeChange(path?:string) {
		if(!this.parent) return;
		const name = path ? `${this.name}.${path}` : this.name;
		this.parent.$notifyPropertyBeforeChange([name]);
	}

	notifyChange(path?:string) {
		if(!this.parent) return;
		const name = path ? `${this.name}.${path}` : this.name;
		this.parent.$notifyPropertyChanged([name]);
	}

	setErrorValue(value:any) {
		let err = new Error(`Must be a ${this.getTypeName()}.`);
		this.error = err;
		log.error(err.message, "Received: ", value);
	}

	applyDefault() {
		// If value was already defined, don't apply default
		if(this.value !== undefined) {
			return;
		}
		let def = isFunction(this.default) ? this.default() : this.default;

		// If Property is required but no default was set, generate one
		if(this.required && isNil(def)) {
			def = this.generateDefaultValue();
		}
		// No default defined, no default to apply
		if(def === undefined) {
			return;
		}
		// Apply
		this.set(def, true);
		const value = this.value;
		if(value as unknown instanceof Mozel) {
			(value as unknown as Mozel).$applyDefaults();
		}
		this._isDefault = true;
	}

	generateDefaultValue():PropertyValue {
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
	 * @param merge
	 */
	tryInit(value:any, merge = false) {
		let current = this._value;

		// Maybe it's an existing Mozel
		if(isPlainObject(value) && !isNil(value.gid)) {
			const mozel = this.parent.$resolveReference(value);
			if(mozel && this.checkType(mozel)) {
				return this._set(mozel);
			}
		}

		// Init reference
		if(this.isReference && isPlainObject(value)) {
			const gid = get(value, 'gid');
			this._ref = gid ? {gid} : undefined;
			this.resolveReference(); // it is possible that it is not yet created
			return true;
		}

		// Init Collection
		if(this.type === Collection && current instanceof Collection && isArray(value)) {
			current.setData(value, true, merge);
			return true;
		}

		// Init Mozel
		if(this.type && isMozelClass(this.type) && isPlainObject(value)) {
			if(current instanceof Mozel && (
				value.gid === current.gid // new data has same gid
				|| (merge && !value.gid)) // or new data has no gid and we merge
			) {
				// Same Mozel, different data
				current.$setData(value, merge);
			} else {
				// Create mozel and try to set again, without type check
				let mozel = this.parent.$create(this.type, value);
				this._set(mozel);
			}
			return true;
		}

		// Parse primitives
		if(this.type && this.isPrimitiveType() && isPrimitive(value)) {
			value = this.tryParseValue(value);
			if(this.checkType(value)) {
				this._set(value);
				return true;
			}
		}

		return false;
	}

	tryParseValue(value:unknown) {
		return Property.tryParseValue(value, this.type);
	}

	getPathFrom(mozel:Mozel) {
		return [...this.parent.$getPathArrayFrom(mozel), this.name].join('.');
	}
}
