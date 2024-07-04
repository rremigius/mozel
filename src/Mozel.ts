import "reflect-metadata";

import Property, {
	Alphanumeric,
	ComplexValue, isComplexType,
	isComplexValue,
	isMozelClass,
	MozelClass,
	PropertyInput,
	PropertyOptions,
	PropertyType,
	PropertyValue
} from './Property';

import {concat, find, forEach, get, isPlainObject, isString, remove, map} from 'lodash';

import Templater from './Templater';
import {Container, inject, injectable, optional} from "inversify";
import MozelFactoryInterface, {MozelFactoryType} from "./MozelFactoryInterface";
import Registry from "./Registry";
import {alphanumeric, isSubClass, primitive} from 'validation-kit';

import {LogLevel} from "log-control";
import log from "./log";
import PropertyWatcher, {
	PropertyChangeHandler,
	PropertyWatcherOptions,
	PropertyWatcherOptionsArgument
} from "./PropertyWatcher";
import MozelFactory from "./MozelFactory";
import EventInterface from "event-interface-mixin";
import {includes, isArray, omit} from "./utils";
import {v4 as uuid} from "uuid";

// TYPES

export type Data = { [key: string]: any }; // General-purpose plain object
export type MozelConstructor<T extends Mozel> = {
	new(...args: any[]): T;
	type: string;
	create<T extends Mozel>(data?: MozelData<T>): T;
};
export type ExportOptions = {type?:string, keys?:string[], shallow?:boolean, nonDefault?:boolean};

// Types for Mozel creation by plain object
export type PropertyKeys<T extends Mozel> = { [K in keyof T]: T[K] extends PropertyValue ? K : never }[keyof T];
export type PropertyData<T> =
	T extends PropertyValue
		? T extends Mozel
			? MozelData<T>
			: T
		: never; // not a PropertyValue
export type MozelData<T extends Mozel> =
	T | (T extends { MozelDataType: any }
		? T['MozelDataType']
		: { [K in PropertyKeys<T>]?: PropertyData<T[K]> }
	);

// Types for schema traversal
export type PropertySchema<T> = {
	$:string; // path
	$path:string; // path
	$pathArray:string[];
	$type:PropertyType;
	$reference:boolean;
	$required:boolean;
}
export type MozelSchema<T> = PropertySchema<T> & {
	[K in keyof T]-?:
	T[K] extends Mozel|undefined
		? MozelSchema<Exclude<T[K], undefined>>
		: PropertySchema<T[K]>
}



type PropertyDefinition<T extends PropertyType> = { name: string, type?: PropertyType, options?: PropertyOptions<T>};
type SchemaDefinition = {type: PropertyType, reference:boolean, required:boolean, path:string[]};

// re-export for easy import together with Mozel
export {Alphanumeric, alphanumeric, MozelClass};
export {LogLevel};

// TYPE GUARDS

export function isData(value: any): value is Data {
	return isPlainObject(value);
}

// DECORATORS

/**
 * PROPERTY decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param {object} options
 */
export function property<T extends PropertyType>(runtimeType?: T, options?: PropertyOptions<T>) {
	return function (target: Mozel, propertyName: string) {
		target.$static.defineClassProperty(propertyName, runtimeType, options);
	};
}
export function string(options?: PropertyOptions<StringConstructor>) {
	return property(String, options);
}
export function number(options?: PropertyOptions<NumberConstructor>) {
	return property(Number, options);
}
export function boolean(options?: PropertyOptions<BooleanConstructor>) {
	return property(Boolean, options);
}

// Some keywords that can shorten property declarations from e.g. {required:true} to {required}
export const required = true;
export const immediate = true;
export const deep = true;
export const trackOld = true;
export const reference = true;
export const shallow = true;

export function schema<M extends Mozel>(MozelClass:MozelConstructor<M> & typeof Mozel):MozelSchema<M> {
	return MozelClass.$schema<M>();
}
export const $s = schema; // shorter alias

export class DestroyedEvent {
	constructor(public mozel:Mozel) {}
}
export class ChangedEvent {
	constructor(public path:string) {}
}

export class MozelEvents extends EventInterface {
	destroyed = this.$event<DestroyedEvent>(DestroyedEvent);
	changed = this.$event(ChangedEvent);
}

/**
 * Mozel class providing runtime type checking and can be exported and imported to and from plain objects.
 */
@injectable()
export default class Mozel {
	public _type?: string; // just for MozelData typing
	static Events = MozelEvents;

	static get type() {
		return this.name; // Try using class name (will not work when uglified).
	};

	static test<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>) {
		return new ExpectedClass() as T;
	}

	static createFactory() {
		return new MozelFactory();
	}

	/**
	 * Access to the logging utility of Mozel, which allows to set log levels and drivers for different components.
	 */
	static get log() {
		return log;
	}

	static getPropertyDefinition(key:string):PropertyDefinition<any>|undefined {
		if(key in this.classPropertyDefinitions) {
			return this.classPropertyDefinitions[key];
		}
		const Parent = Object.getPrototypeOf(this);
		if(!isSubClass(Parent, Mozel)) {
			return undefined;
		}
		return (<typeof Mozel>Parent).getPropertyDefinition(key);
	}

	static validateInitData(data:unknown) {
		return isPlainObject(data);
	}

	/**
	 * Get this Mozel's schema.
	 * @param {SchemaDefinition} [definition]	The definition from the parent's
	 */
	static $schema<M extends Mozel>(definition?:SchemaDefinition):MozelSchema<M> {
		function schemaFromDefinition(definition:SchemaDefinition):PropertySchema<M> {
			const pathArray = definition.path;
			const path = pathArray.join('.');
			return {
				$type: definition.type,
				$reference: definition.reference,
				$required: definition.required,
				$pathArray: pathArray,
				$path: path,
				$: path
			}
		}
		return new Proxy(this, {
			get(target, key) {
				// Current schema (based on parent definition, if provided)
				if(!definition) {
					// Default starting 'definition'
					definition = {type: target, required: false, reference: false, path: []};
				}

				if(!isString(key)) {
					return undefined;
				}

				// For $-properties, return schema definition
				if(key.substring(0,1) === '$') {
					const schema = schemaFromDefinition(definition);
					return (schema as any)[key];
				}

				// Try sub-properties
				let def = target.getPropertyDefinition(key);
				if(!def) {
					throw new Error(`Mozel path does not exist: ${[...definition.path, key]}`);
				}
				const subDefinition = {
					type: def.type,
					reference: get(def, 'options.reference', false),
					required: get(def, 'options.required', false),
					path: [...definition.path, key]
				}
				if(isSubClass(def.type, Mozel)) {
					const SubType = def.type as unknown as typeof Mozel;
					return SubType.$schema(subDefinition);
				} else {
					// Cannot go deeper because next level is not a Mozel
					return schemaFromDefinition(subDefinition);
				}
			}
		}) as unknown as MozelSchema<M>;
	}
	static $<M extends Mozel>(definition?:SchemaDefinition):MozelSchema<M> {
		return this.$schema(definition);
	}

	private static _classPropertyDefinitions: Record<string, PropertyDefinition<PropertyType>> = {};

	// Injected properties
	public readonly $factory: MozelFactoryInterface;
	public readonly $registry: Registry<Mozel>;

	private _properties: Record<string, Property> = {};

	private _property: Property | null = null;
	private _propertyLock: boolean = false;
	private _strict?: boolean;
	private readonly _watchers: PropertyWatcher[];

	private _trackChangesID?:string = undefined;
	private _trackedChangePaths:Set<string> = new Set<string>();

	public $root:boolean = false;
	public $destroyed: boolean = false;
	public $events:MozelEvents;

	@property(Alphanumeric, {required, default:()=>uuid()})
	gid!: alphanumeric; // a non-database ID that can be used to reference other mozels

	/**
	 * Define a property for the mozel.
	 * @param {string} name					Name of the property
	 * @param {PropertyType} [runtimeType]	Type to check at runtime
	 * @param {PropertyOptions} [options]
	 */
	static property<T extends PropertyType>(name:string, runtimeType?:T, options?:PropertyOptions<T>) {
		return this.defineClassProperty(name, runtimeType, options);
	}
	static defineClassProperty<T extends PropertyType>(name: string, runtimeType?:T, options?: PropertyOptions<T>) {
		this.classPropertyDefinitions[name] = {name, type: runtimeType, options: options as PropertyOptions<PropertyType>|undefined};
	}

	/**
	 * Instantiate a Mozel, based on raw data.
	 * Set as $root, so will not destroy itself when removed from hierarchy.
	 * @param {Data} [data]
	 */
	static create<T extends Mozel>(data?: MozelData<T>):T {
		const factory = this.createFactory();
		return <T>factory.createRoot(this, data as any);
	}

	static getParentClass() {
		return Object.getPrototypeOf(this);
	}

	/**
	 * Definitions of Properties made at class level.
	 */
	protected static get classPropertyDefinitions() {
		// Override _classPropertyDefinitions so this class has its own set and it will not add its properties to its parent
		if (!this.hasOwnProperty('_classPropertyDefinitions')) {
			this._classPropertyDefinitions = {};
		}
		return this._classPropertyDefinitions;
	}

	constructor(
		@inject(MozelFactoryType) @optional() mozelFactory?: MozelFactoryInterface
	) {
		this.$factory = mozelFactory || this.$static.createFactory();
		this.$registry = this.$factory.registry;
		this._watchers = [];

		this.$define();
		this.$events = new this.$static.Events();

		this.$applyDefaults();

		this.$init();
	}

	get $static(): typeof Mozel {
		return <typeof Mozel>this.constructor;
	}

	$init() {
	} // for override


	get $properties() {
		return this._properties;
	}

	$startTrackingChanges() {
		this._trackedChangePaths.clear();
		this.$notifyPropertyBeforeChange([]); // let watcher get current state
		this._trackChangesID = uuid();
		return this._trackChangesID;
	}

	$finishTrackingChanges(id:string) {
		if(this._trackChangesID !== id) {
			return; // current tracking session is owned by someone else
		}
		this._trackChangesID = undefined; // release tracking session
		if(this._trackedChangePaths.size > 0) {
			for(let path of this._trackedChangePaths.values()) {
				this.$notifyPropertyChanged(path.split('.'));
			}
		}
		this._trackedChangePaths.clear();
	}

	/**
	 * Instantiate a Mozel based on the given class and the data.
	 * @param Class
	 * @param data
	 * @param init
	 */
	$create<T extends Mozel>(Class: MozelConstructor<T>, data?: MozelData<T>, init?: (mozel:T)=>void):T {
		// Preferably, use DI-injected factory
		return this.$factory.create(Class, data, init);
	}

	$destroy() {
		this.$destroyed = true;
		// First remove _watchers to avoid confusing them with the break-down
		this._watchers.splice(0, this._watchers.length);

		this.$forEachChild(mozel => mozel.$destroy());
		this.$events.destroyed.fire(new DestroyedEvent(this));

		this.$factory.destroy(this);
	}

	/**
	 * Will destroy itself if not root and without parent.
	 */
	$maybeCleanUp() {
		if(!this.$root && !this._property) {
			this.$destroy();
		}
	}

	/**
	 * Removes the Mozel from its parent.
	 * @param {boolean} makeRoot	Set to `true` to prevent the Mozel from cleaning up next tick.
	 */
	$detach(makeRoot: boolean = false) {
		if (this._propertyLock) {
			throw new Error(this.$static.name + " is locked to its parent and cannot be transferred.");
		}
		// If property still holds this Mozel as its value, unset it
		if(this._property && this._property.value === this) {
			this._property.set(undefined);
		}
		this._property = null;

		if(makeRoot) this.$root = true;
		setTimeout(() => {
			this.$maybeCleanUp();
		});
	}

	$setProperty(property:Property, lock = false) {
		if(property == this._property) return; // nothing to do

		if(this._propertyLock) {
			throw new Error(this.$static.name + " is locked to its parent and cannot be transferred.");
		}

		if(property.getParent().$factory !== this.$factory || property.getParent().$registry !== this.$registry) {
			throw new Error("Cannot mix Mozels from different Factories or Registries within the same hierarchy.");
		}

		if(this._property) {
			this._property.set(undefined);
		}
		this._property = property;
		this._propertyLock = lock;
		this.$root = false;
	}

	$remove(child:PropertyValue, includeReferences = false) {
		for (let key in this.$properties) {
			const property = this.$properties[key];
			if(!includeReferences && property.isReference) continue;

			if(property.value === child) {
				property.set(undefined);
			}
		}
	}

	$findParent(predicate:(mozel:Mozel, relation:string)=>boolean):Mozel|undefined {
		if(!this.$parent) return undefined;
		if(predicate(this.$parent, this.$relation as string)) return this.$parent;

		return this.$parent.$findParent(predicate);
	}

	/**
	 * The Mozel's parent.
	 */
	get $parent() {
		if(!this._property) return null;
		return this._property.getParent();
	}

	/**
	 * The Mozel's relation to its parent.
	 */
	get $relation() {
		if(!this._property) return null;
		return this._property.name;
	}

	/**
	 * @protected
	 * For override. Any properties of the mozel should be defined here.
	 */
	$define() {
		// To be called for each class on the prototype chain
		const _defineData = (Class: MozelClass) => {
			if (Class !== Mozel) {
				// Define class properties of parent class
				_defineData(Object.getPrototypeOf(Class));
			}
			// Define class properties of this class
			forEach(Class.classPropertyDefinitions, (property: PropertyDefinition<PropertyType>) => {
				this.$defineProperty(property.name, property.type, property.options);
			});
		};
		_defineData(this.$static);
	}

	/**
	 * Defines a property to be part of the Mozel's data. Only defined properties will be exported and imported
	 * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
	 *
	 * @param {string} name						The name of the property.
	 * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
	 * 											Number, String, Alphanumeric, Boolean, (subclass of) Mozel or undefined.
	 * @param {PropertyOptions} [options]
	 */
	$defineProperty<T extends PropertyType>(name: string, type?: T, options?: PropertyOptions<T>) {
		let property = new Property(this, name, type, options as PropertyOptions<unknown>);
		this._properties[name] = property;

		// Create getter/setter
		let currentValue = get(this, name);
		Object.defineProperty(this, name, {
			get: () => this.$get(name),
			set: value => this.$set(name, value, true),
			configurable: true
		});
		// Preset value
		if (currentValue !== undefined) {
			this.$set(name, currentValue);
		}
		return property;
	}

	$undefineProperty(name: string) {
		const property = this._properties[name];
		if(!property) return;
		this._properties[name].set(undefined);
		delete this._properties[name];
	}

	/**
	 * Set value with type checking.
	 * @param {string|number} property  The name of the property
	 * @param {PropertyInput} value		The value to set on the property
	 * @param {boolean} init			If set to true, Mozels may be initialized from objects and arrays, respectively.
	 * @param {boolean} merge			If set to true, Mozels will be kept if gid did not change; data will be set instead
	 */
	$set(property: string, value: PropertyInput, init = true, merge = false) {
		if(this.$destroyed) {
			throw new Error(`Trying to set Mozel property value after it has been destroyed.`);
		}
		if (!(property in this._properties)) {
			throw new Error(`Could not set non-existing property '${property}' on ${this.$name}.`);
		}
		return this._properties[property].set(value, init, merge);
	}

	/**
	 * Get type-safe value of the given property.
	 * @param {string} property
	 * @param {boolean} resolveReference	If set to false, will not try to resolve any references.
	 */
	$get(property: string, resolveReference = true):PropertyValue {
		if(this.$destroyed && property !== 'gid') { // we accept gid because it may still be needed to identify
			throw new Error(`Accessing Mozel after it has been destroyed.`);
		}

		if(property === '') return this;

		if (!(property in this._properties)) {
			throw new Error(`Could not get non-existing property '${property}' on ${this.$name}.`);
		}
		return this._properties[property].get(resolveReference);
	}

	/**
	 * Get the Property object with the given name.
	 * @param property
	 */
	$property(property?: string):Property|undefined|null {
		if(property === undefined) {
			return this._property;
		}
		return this._properties[property];
	}

	/**
	 * Alias of $property
	 */
	$ = this.$property;

	/**
	 * Get value at given path (not type-safe).
	 * @param {string|string[]} path
	 * @param {boolean}	resolveReferences	If false, will not try to resolve any encountered references.
	 */
	$path(path:string|string[], resolveReferences = true):PropertyValue {
		if(isString(path)) {
			path = path.split('.');
		}
		if(path.length === 0) return this;

		const step = path[0];
		if(!this.$has(step)) return undefined;

		const value = this.$get(step);
		if(path.length === 1) return value;

		if(value instanceof Mozel) {
			return value.$path(path.slice(1));
		}
		return undefined;
	}

	/**
	 * Gets all path values mathing the given path pattern.
	 * @param {string|string[]} pathPattern	Path pattern to match. May include wildcards ('*').
	 * @param {string[]} startingPath		Path to prepend to the resulting paths. Used for recursion.
	 * @param {boolean} resolveReferences	If set to false, will not try to resolve any encountered references.
	 */
	$pathPattern(pathPattern:string|string[], startingPath:string[]=[], resolveReferences = true):Record<string,PropertyValue> {
		if(isString(pathPattern)) {
			pathPattern = pathPattern.split('.');
		}
		if(pathPattern.length === 0) return {[startingPath.join('.')]: this};

		const step = pathPattern[0];
		const properties = step === '*' ? Object.keys(this._properties) : [step];
		if(pathPattern.length === 1) {
			let values:Record<string, PropertyValue> = {};
			for(let name of properties) {
				values = {
					...values,
					[concat(startingPath, name).join('.')]: this.$get(name, resolveReferences)
				}
			}
			return values;
		}
		// Path length > 1
		let values:Record<string, PropertyValue> = {};
		for(let name of properties) {
			const value = this.$get(name, resolveReferences);
			if(!isComplexValue(value)) {
				continue; // cannot continue on this path
			}
			const subValues = value.$pathPattern(pathPattern.slice(1), [...startingPath, name], resolveReferences)
			values = {
				...values,
				...subValues
			}
		}
		return values;
	}

	$getPath():string {
		return this.$getPathArray().join('.');
	}

	$getPathArray():string[] {
		if(!this.$parent || !this.$relation) {
			return [];
		}
		return [...this.$parent.$getPathArray(), this.$relation];
	}

	$getPathFrom(mozel:Mozel):string {
		return this.$getPathArrayFrom(mozel).join('.');
	}

	$getPathArrayFrom(mozel:Mozel):string[] {
		if(this === mozel) return [];

		if(!this.$parent || !this.$relation) throw new Error("No path from given Mozel found.");

		return [...this.$parent.$getPathArrayFrom(mozel), this.$relation];
	}

	$setPath(path:string|string[], value:any, initAlongPath = true):unknown {
		const pathArray = isArray(path) ? path : path.split('.');
		if(pathArray.length === 0) {
			throw new Error("Cannot set 0-length path.");
		}
		if(pathArray.length === 1) {
			return this.$set(pathArray[0], value);
		}
		const property = this.$property(pathArray[0]);
		if(!property || !property.isMozelType()) {
			throw new Error(`Cannot follow path at property '${pathArray[0]} of ${this}.'`);
		}

		// Initialize property value if necessary
		if(!property.value && property.isMozelType() && initAlongPath) {
			property.set({}, true);
		}

		// Continue path
		const sub = property.value;
		const newPath = pathArray.slice(1);
		if(sub instanceof Mozel) {
			return sub.$setPath(newPath, value, initAlongPath);
		}

		// Should not be possible:
		throw new Error(`Cannot follow path at property '${pathArray[0]} of ${this}. Unexpected error.'`);
	}

	/**
	 * Sets all registered properties from the given data.
	 * @param {object} data			The data to set into the mozel.
	 * @param {boolean} merge		If set to `true`, only defined keys will be set.
	 */
	$setData(data: Data, merge = false) {
		const trackID = this.$startTrackingChanges();
		forEach(this._properties, (property: Property, key: string) => {
			if (!merge || key in data) {
				this.$set(key, data[key], true, merge);
			}
		});
		this.$finishTrackingChanges(trackID);
	}

	/**
	 * Watch changes to the given path.
	 * @param {PropertyWatcherOptionsArgument} options
	 */
	$watch<T extends PropertyValue>(path:string|PropertySchema<T>|MozelSchema<T>, handler:PropertyChangeHandler<T>, options?:PropertyWatcherOptionsArgument) {
		const finalPath = isString(path) ? path : path.$path;
		const allOptions = {
			...options,
			...{
				path:finalPath,
				handler:<PropertyChangeHandler<PropertyValue>><unknown>handler
			}
		}
		const watcher = new PropertyWatcher(this, allOptions);
		this.$addWatcher(watcher);
		return watcher;
	}

	/**
	 * Get _watchers matching the given path.
	 * @param {string} path
	 */
	$watchers(path:string) {
		return this._watchers.filter(watcher => watcher.matches(path));
	}

	$addWatcher(watcher:PropertyWatcher) {
		this._watchers.push(watcher);
		if(watcher.immediate) watcher.execute(watcher.path);
	}

	$removeWatcher(watcher:PropertyWatcher) {
		remove(this._watchers, w => w === watcher);
	}

	/**
	 * Notify that a property is about to change. Will set the current value for any relevant _watchers, so they can
	 * compare the new value to the old value, and provide the old value to the handler.
	 *
	 * This just-in-time approach has the slight advantage that we don't have to keep copies of values that will
	 * never change.
	 *
	 * @param {string[]} path		The path at which the change occurred.
	 */
	$notifyPropertyBeforeChange(path: string[]) {
		if(this._trackChangesID) {
			// Don't notify parents/watchers, collecting all changes
			return;
		}

		const pathString = path.join('.');
		this.$watchers(pathString).forEach(watcher => {
			watcher.updateValues(pathString)
		});
		if(this.$parent && this.$relation) {
			this.$parent.$notifyPropertyBeforeChange([this.$relation, ...path]);
		}
	}

	/**
	 * Check with all registered watchers if property can be changed to its new value.
	 * @param {string[]} path
	 */
	$validatePropertyChange(path: string[]) {
		const pathString = path.join('.');

		// If any of the watchers does not agree, cancel the change
		if(!!this.$watchers(pathString).find(watcher =>
			watcher.validator && !watcher.validate(pathString))
		) {
			return false;
		}
		if (this.$parent && this.$relation && !this.$parent.$validatePropertyChange([this.$relation, ...path])) {
			return false;
		}
		return true;
	}

	/**
	 * Notify that a property has changed. Will activate relevant _watchers.
	 * @param {string[]} path		Path at which the property changed.
	 * @param {Mozel} [submozel]	The direct submozel reporting the change.
	 */
	$notifyPropertyChanged(path: string[]) {
		const pathString = path.join('.');
		this.$events.changed.fire(new ChangedEvent(pathString));

		if(this._trackChangesID) {
			// Don't notify parents or watchers, wait for end of tracking
			this._trackedChangePaths.add(path.join('.'));
			return;
		}

		this.$watchers(pathString).forEach(watcher => {
			watcher.execute(pathString);
		});
		if (this.$parent && this.$relation) {
			this.$parent.$notifyPropertyChanged([this.$relation, ...path]);
		}
	}

	/**
	 * Resolves the given reference.
	 * @param {{gid:alphanumeric}} ref
	 */
	$resolveReference(ref: { gid: alphanumeric }) {
		if (!this.$registry) return;

		// Resolve provided reference
		return this.$registry.byGid(ref.gid);
	}

	/**
	 * Resolves all reference Properties
	 */
	$resolveReferences() {
		forEach(this._properties, (property: Property, key: string) => {
			property.resolveReferences();
		});
	}

	/**
	 * Applies all defined defaults to the properties.
	 */
	$applyDefaults() {
		forEach(this._properties, (property: Property) => {
			property.applyDefault();
		});
	}

	/**
	 * Check if any property has received a different value than its default.
	 */
	$isDefault() {
		return !!find(this._properties, (property: Property) => {
			return !property.isDefault();
		});
	}

	/**
	 * Set only primitive properties from given data.
	 * @param {Data} properties
	 */
	$setPrimitiveProperties(properties: Data) {
		forEach(this._properties, (value: Property, key: string) => {
			if (!(key in properties) || !this.$isPrimitiveProperty(key)) {
				return;
			}
			this.$set(key, value);
		});
	}

	/**
	 * Get only primitive type properties.
	 * @return {[key:string]:Primitive}
	 */
	$getPrimitiveProperties() {
		let properties: { [key: string]: primitive } = {};
		forEach(this._properties, (property: Property, key: string) => {
			if (this.$isPrimitiveProperty(key)) {
				properties[key] = <primitive>this._properties[key].value;
			}
		});
		return properties;
	}

	/**
	 * Get only complex type properties.
	 * @return {[key:string]:ComplexValue}
	 */
	$getComplexProperties() {
		let relations: { [key: string]: ComplexValue } = {};

		forEach(this._properties, (property: Property, key: string) => {
			if (!this.$isPrimitiveProperty(key)) {
				relations[key] = <ComplexValue>this._properties[key].value;
			}
		});
		return relations;
	}

	/**
	 * Check if the given property is a primitive.
	 * @param key
	 */
	$isPrimitiveProperty(key: string) {
		let type = this._properties[key].type;
		return !isMozelClass(type);
	}

	/**
	 * Checks if the Mozel has a property
	 * @param property
	 */
	$has(property: string) {
		return property in this._properties;
	}

	$eachProperty(callback:(property:Property)=>void) {
		for(let name in this.$properties) {
			callback(this.$properties[name]);
		}
	}

	$mapProperties<T>(callback:(property:Property)=>T) {
		return map(this.$properties, callback);
	}

	/**
	 * Export defined properties to a plain (nested) object.
	 * @param {string} [options.type]				Passed on recursively to each $export, based on which Mozel classes
	 * 												can determine the keys they should export.
	 * @param {string|string[]} [options.keys]		Only the given keys will be exported. This is not passed down the hierarchy.
	 * @return {Data}
	 */
	$export(options?:ExportOptions): Data {
		const $options = options || {};

		let exported: Data = {};
		if (this.$static.hasOwnProperty('type') && !$options.keys || includes($options.keys, '_type')) {
			exported._type = this.$static.type; // using parent's type confuses any factory trying to instantiate based on this export
		}

		forEach(this._properties, (property: Property, name: string) => {
			if(isArray($options.keys) && !includes($options.keys, name)) return;
			if($options.nonDefault && property.isDefault()) return;

			if(property.isReference) {
				// If property was not yet resolved, just use the reference instead. Will prevent infinite loops with deep watchers
				return exported[name] = property.value ? {gid: (property.value as Mozel).gid} : undefined;
			}
			let value = property.value;

			if (value instanceof Mozel) {
				return exported[name] = $options.shallow ? value.$export({keys: ['gid']}) : value.$export(omit($options, 'keys'));
			}
			exported[name] = value;
		});

		return exported;
	}

	/**
	 * Creates a deep clone of the mozel.
	 */
	$cloneDeep<T extends Mozel>():T {
		// Use new factory with same dependencies but different Registry.
		const dependencies = this.$factory.dependencies;
		const factory = new MozelFactory(dependencies, new Registry<Mozel>());

		// TODO: when cloning, init information is lost (e.g. collection item type).
		// Cannot simply copy init function because it may contain references to Properties from the old Mozel
		// Copy relevant properties one by one from an init function here?
		// Init function in $cloneDeep parameter so child classes (e.g. Collection) can add their stuff?

		return factory.create(this.$static, this.$export() as MozelData<any>) as T;
	}

	/**
	 * Can disable _strict type checking, so properties can have invalid values. Errors will be stored in the Properties
	 * with invalid states.
	 * When using the properties in non-_strict mode, always use type checking at runtime. Typescript will not complain.
	 * @param _strict
	 */
	set $strict(strict:boolean) {
		this._strict = strict;
	}

	get $strict():boolean {
		// Get
		if(this._strict === undefined && this.$parent) {
			return this.$parent.$strict;
		}
		return this._strict !== false;
	}

	/**
	 * Returns validation errors in the Mozel
	 * @param {boolean} deep	If set to `true`, will return all errors of all submozels recursively.
	 * 							Defaults to `false`, returning only errors of direct properties.
	 */
	get $errors() {
		const errors:Record<string, Error> = {};
		for(let name in this._properties) {
			const property = this._properties[name];
			if(property.error) {
				errors[name] = property.error;
			}
		}
		return errors;
	}

	$errorsDeep() {
		const errors = this.$errors;
		for(let name in this._properties) {
			const property = this._properties[name];
			if (isComplexValue(property.value)) {
				const subErrors = property.value.$errorsDeep();
				for (let path in subErrors) {
					errors[`${name}.${path}`] = subErrors[path];
				}
			}
		}
		return errors;
	}

	/**
	 * Renders string templates in all properties of the Mozel, recursively.
	 * @param {Templater|object} templater	A Templater to use to render the templates, or a data object to fill in the values.
	 * If a data object is provided, a new Templater will be instantiated with that data object.
	 */
	$renderTemplates(templater: Templater | Data) {
		if (!(templater instanceof Templater)) {
			// Instantiate new Templater with given data.
			templater = new Templater(templater);
		}

		forEach(this._properties, (property: Property, key: string) => {
			let value = property.value;
			if(value instanceof Mozel) {
				value.$renderTemplates(templater);
				return;
			}
			if (isString(value)) {
				// Render template on string and set new value
				this.$set(key, templater.render(value));
				return;
			}
		});
	}

	$forEachChild(callback:(mozel:Mozel, key:string) => void) {
		forEach(this._properties, (property:Property, key:string) => {
			if(property.value instanceof Mozel) {
				return callback(property.value, key);
			}
		});
	}

	// For override

	get $name() {
		return `${this.$static.type} (${this.gid})`;
	}

	toString() {
		return this.$name;
	}
}
