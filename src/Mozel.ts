import "reflect-metadata";

import Property, {
	Alphanumeric,
	ComplexValue,
	isComplexValue,
	isMozelClass,
	MozelClass,
	PropertyInput,
	PropertyOptions,
	PropertyType,
	PropertyValue
} from './Property';
import Collection, {CollectionOptions, CollectionType} from './Collection';

import {concat, find, forEach, get, isPlainObject, isString} from 'lodash';

import Templater from './Templater';
import {Container, inject, injectable, optional} from "inversify";
import {injectableMozel} from "./inversify";
import MozelFactoryInterface, {MozelFactoryType} from "./MozelFactoryInterface";
import Registry from "./Registry";
import {alphanumeric, primitive} from 'validation-kit';

import {LogLevel} from "log-control";
import log from "./log";
import PropertyWatcher, {PropertyWatcherOptions} from "./PropertyWatcher";

// TYPES

export type Data = { [key: string]: any }; // General-purpose plain object
export type MozelConstructor<T extends Mozel> = {
	new(...args: any[]): T;
	type: string;
};

// Types for Mozel creation by plain object
export type PropertyKeys<T extends Mozel> = { [K in keyof T]: T[K] extends PropertyValue ? K : never }[keyof T];
export type CollectionData<T> =
	T extends Mozel
		? MozelData<T>[]|T[]
		: T extends primitive
			? T[] | Collection<T>
			: never;
export type PropertyData<T> =
	T extends PropertyValue
		? T extends Mozel
			? MozelData<T>
			: T extends Collection<infer C>
				? CollectionData<C>
				: T
		: false; // not a PropertyValue
export type MozelData<T extends Mozel> = T extends { MozelDataType: any }
	? T['MozelDataType'] : { [K in PropertyKeys<T>]?: PropertyData<T[K]> };

type PropertyDefinition = { name: string, type?: PropertyType, options?: PropertyOptions };
type CollectionDefinition = { name: string, type?: CollectionType, options?: CollectionOptions };

// re-export for easy import together with Mozel
export {Alphanumeric, alphanumeric, MozelClass};
export {injectableMozel};
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
export function property(runtimeType?: PropertyType, options?: PropertyOptions) {
	return function (target: Mozel, propertyName: string) {
		target.static.defineClassProperty(propertyName, runtimeType, options);
	};
}

/**
 * PROPERTY decorator factory
 * Defines a runtime type-safe Collection for this property and overrides the the current property
 * with a getter/setter to access the Collection.
 * @param {PropertyType} runtimeType
 * @param {CollectionOptions} options
 */
export function collection(runtimeType?: CollectionType, options?: CollectionOptions) {
	return function (target: Mozel, propertyName: string) {
		target.static.defineClassCollection(propertyName, runtimeType, options);
	};
}

// Some keywords that can shorten property declarations from e.g. {required:true} to {required}
export const required = true;
export const immediate = true;
export const deep = true;
export const reference = true;


/**
 * Mozel class providing runtime type checking and can be exported and imported to and from plain objects.
 */
@injectable()
export default class Mozel {
	public _type?: string; // just for MozelData typing
	static get type() {
		return this.name; // Try using class name (will not work when uglified).
	};

	/**
	 * Access to the logging utility of Mozel, which allows to set log levels and drivers for different components.
	 */
	static get log() {
		return log;
	}

	static injectable(container:Container) {
		// Non-typescript alternative for decorator
		injectableMozel(container)(this);
	}

	private static _classPropertyDefinitions: (PropertyDefinition)[] = [];
	private static _classCollectionDefinitions: (CollectionDefinition)[] = [];

	// Injected properties
	private readonly mozelFactory?: MozelFactoryInterface;
	private readonly registry?: Registry<Mozel>;

	private properties: Record<string, Property> = {};

	private parent: Mozel | null = null;
	private parentLock: boolean = false;
	private relation: string | null = null;
	private strict?: boolean;

	private readonly watchers: PropertyWatcher[];

	@property(Alphanumeric)
	id?: alphanumeric;
	@property(Alphanumeric, {required})
	gid: alphanumeric = 0; // a non-database ID that can be used to reference other mozels

	isReference: boolean = false;

	/**
	 * Define a property for the mozel.
	 * @param {string} name					Name of the property
	 * @param {PropertyType} [runtimeType]	Type to check at runtime
	 * @param {PropertyOptions} [options]
	 */
	static property(name:string, runtimeType?:PropertyType, options?:PropertyOptions) {
		return this.defineClassProperty(name, runtimeType, options);
	}
	static defineClassProperty(name: string, runtimeType?: PropertyType, options?: PropertyOptions) {
		this.classPropertyDefinitions.push({name, type: runtimeType, options});
	}

	/**
	 * Define a collection for the mozel.
	 * @param {string} name					Name of the collection
	 * @param {CollectionType} runtimeType	Type to check on the items in the collection
	 * @param {CollectionOptions} options
	 */
	static collection(name: string, runtimeType?: CollectionType, options?: CollectionOptions) {
		return this.defineClassCollection(name, runtimeType, options);
	}
	static defineClassCollection(name: string, runtimeType?: CollectionType, options?: CollectionOptions) {
		this.classCollectionDefinitions.push({name, type: runtimeType, options});
	}

	/**
	 * Instantiate a Mozel based on raw data.
	 * @param {Data} [data]
	 */
	static create<T extends Mozel>(data?: MozelData<T>):T {
		// Instantiate this class.
		const mozel = new this();
		if (data) {
			mozel.$setData(data, true);
		}
		return <T>mozel;
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
			this._classPropertyDefinitions = [];
		}
		return this._classPropertyDefinitions;
	}

	/**
	 * Definitions of Collections made at class level.
	 */
	protected static get classCollectionDefinitions() {
		// Override _classPropertyDefinitions so this class has its own set and it will not add its properties to its parent
		if (!this.hasOwnProperty('_classCollectionDefinitions')) {
			this._classCollectionDefinitions = [];
		}
		return this._classCollectionDefinitions;
	}

	constructor(
		@inject(MozelFactoryType) @optional() mozelFactory?: MozelFactoryInterface,
		@inject(Registry) @optional() registry?: Registry<Mozel>
	) {
		this.mozelFactory = mozelFactory;
		this.registry = registry;
		this.watchers = [];

		this.$define();

		// Check if subclass properly overrode defineData method.
		if (!('id' in this.properties)) {
			log.warn(`Modl property 'id' was not defined in mozel ${this.$name()}. Perhaps defineData did not call super?`);
		}

		this.$applyDefaults();

		this.$init();
	}

	get static(): typeof Mozel {
		return <typeof Mozel>this.constructor;
	}

	$init() {
	} // for override

	get $properties() {
		return this.properties;
	}

	/**
	 * Instantiate a Mozel based on the given class and the data.
	 * @param Class
	 * @param data
	 * @param root					If true, references will be resolved after creation.
	 * @param asReference		If true, will not be registered.
	 */
	$create(Class: MozelClass, data?: Data, root: boolean = false, asReference: boolean = false) {
		if (this.mozelFactory) {
			// Preferably, use DI-injected factory
			return this.mozelFactory.create(Class, data, root, asReference);
		}
		// Otherwise, just create an instance of this class.
		return Class.create(data);
	}

	$destroy() {
		if (this.mozelFactory) {
			this.mozelFactory.destroy(this);
		}
	}

	/**
	 * Set the Mozel's parent Mozel.
	 * @param {Mozel} parent			The parent this Mozel is a child of.
	 * @param {string} relation			The name of the parent-child relationship.
	 * @param {boolean} lock			Locks the Mozel to the parent, so it cannot be transferred to another parent.
	 */
	$setParent(parent: Mozel, relation: string, lock: boolean = true) {
		if (this.parentLock) {
			throw new Error(this.static.name + " is locked to its parent and cannot be transferred.");
		}
		this.parent = parent;
		this.relation = relation;
		this.parentLock = lock;
	}

	/**
	 * The Mozel's parent.
	 */
	get $parent() {
		return this.parent;
	}

	/**
	 * The Mozel's relation to its parent.
	 */
	get $relation() {
		return this.relation;
	}

	/**
	 * @protected
	 * For override. Any properties and collections of the mozel should be defined here.
	 */
	$define() {
		// To be called for each class on the prototype chain
		const _defineData = (Class: MozelClass) => {
			if (Class !== Mozel) {
				// Define class properties of parent class
				_defineData(Object.getPrototypeOf(Class));
			}
			// Define class properties of this class
			forEach(Class.classPropertyDefinitions, (property: PropertyDefinition) => {
				this.$defineProperty(property.name, property.type, property.options);
			});
			forEach(Class.classCollectionDefinitions, (collection: CollectionDefinition) => {
				this.$defineCollection(collection.name, collection.type, collection.options);
			});
		};
		_defineData(this.static);
	}

	/**
	 * Defines a property to be part of the Mozel's data. Only defined properties will be exported and imported
	 * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
	 *
	 * @param {string} name							The name of the property.
	 * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
	 * 																	Number, String, Alphanumeric, Boolean, (subclass of) Mozel, Collection or undefined.
	 * @param {PropertyOptions} [options]
	 */
	$defineProperty(name: string, type?: PropertyType, options?: PropertyOptions) {
		let property = new Property(this, name, type, options);
		this.properties[name] = property;

		// Create getter/setter
		let currentValue = get(this, name);
		Object.defineProperty(this, name, {
			get: () => this.$get(name),
			set: value => this.$set(name, value)
		});
		// Preset value
		if (currentValue !== undefined) {
			this.$set(name, currentValue);
		}
		return property;
	}

	/**
	 * Defines a property and instantiates it as a Collection.
	 * @param {string} relation       				The relation name.
	 * @param {Mozel} [type]       						The class of the items in the Collection.
	 * @param {CollectionOptions} [options]
	 * @return {Collection}
	 */
	$defineCollection(relation: string, type?: CollectionType, options?: CollectionOptions) {
		let collection = new Collection(this, relation, type);
		collection.isReference = (options && options.reference) === true;

		this.$defineProperty(relation, Collection, {
			required: true,
			default: collection
		});
		return collection;
	}

	/**
	 * Set value with type checking.
	 * @param {string} property				The name of the property
	 * @param {PropertyInput} value		The value to set on the property
	 * @param {boolean} init					If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
	 */
	$set(property: string, value: PropertyInput, init = false) {
		if (!(property in this.properties)) {
			throw new Error(`Could not set non-existing property '${property}' on ${this.$name()}.`);
		}
		this.properties[property].set(value, init);
		return true;
	}

	/**
	 * Get type-safe value of the given property.
	 * @param {string} property
	 */
	$get(property: string) {
		if (!(property in this.properties)) {
			throw new Error(`Could not get non-existing property '${property}' on ${this.$name()}.`);
		}
		return this.properties[property].value;
	}

	/**
	 * Get the Property object with the given name.
	 * @param property
	 */
	$property<K extends PropertyKeys<this> & string>(property:K) {
		return this.properties[property];
	}

	/**
	 * Get value at given path (not type-safe).
	 * @param path
	 */
	$path(path:string|string[]):PropertyValue {
		if(isString(path)) {
			path = path.split('.');
		}
		if(path.length === 0) return undefined;

		const step = this.$get(path[0]);
		if(path.length === 1) return step;

		if(step instanceof Collection) {
			return step.path(path.slice(1));
		}
		if(step instanceof Mozel) {
			return step.$path(path.slice(1));
		}
		return undefined;
	}

	/**
	 * Gets all path values mathing the given path pattern.
	 * @param {string|string[]} pathPattern	Path pattern to match. May include wildcards ('*').
	 * @param {string[]} startingPath		Path to prepend to the resulting paths. Used for recursion.
	 */
	$pathPattern(pathPattern:string|string[], startingPath:string[]=[]):Record<string,PropertyValue> {
		if(isString(pathPattern)) {
			pathPattern = pathPattern.split('.');
		}
		if(pathPattern.length === 0) return {};

		const step = pathPattern[0];
		const properties = step === '*' ? Object.keys(this.properties) : [step];
		if(pathPattern.length === 1) {
			let values:Record<string, PropertyValue> = {};
			for(let name of properties) {
				values = {
					...values,
					[concat(startingPath, pathPattern).join('.')]: this.$get(name)
				}
			}
			return values;
		}
		// Path length > 1
		let values:Record<string, PropertyValue> = {};
		for(let name of properties) {
			const value = this.$get(name);
			if(!isComplexValue(value)) {
				continue; // cannot continue on this path
			}
			const subValues = value instanceof Mozel
				? value.$pathPattern(pathPattern.slice(1), [...startingPath, name])
				: value.pathPattern(pathPattern.slice(1), [...startingPath, name])
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
		if(!this.parent || !this.relation) {
			return [];
		}
		return [...this.parent.$getPathArray(), this.relation];
	}

	/**
	 * Sets all registered properties from the given data.
	 * @param {object} data			The data to set into the mozel.
	 * @param {boolean} [init]	If set to true, Mozels and Collections can be initialized from objects and arrays.
	 */
	$setData(data: Data, init = false) {
		forEach(this.properties, (property: Property, key: string) => {
			if (key in data) {
				this.$set(key, data[key], init);
			}
		});
	}

	/**
	 * Watch changes to the given path.
	 * @param {PropertyWatcherOptions} options
	 */
	$watch(options: PropertyWatcherOptions) {
		const watcher = new PropertyWatcher(this, options);
		this.watchers.push(watcher);
	}

	/**
	 * Get watchers matching the given path.
	 * @param {string} path
	 */
	$watchers(path:string) {
		return this.watchers.filter(watcher => watcher.matches(path));
	}

	/**
	 * If the given submozel is part of a collection of this mozel, will add the collection index of the submozel to
	 * the given path.
	 *
	 * @param {Mozel} submozel	Direct submozel.
	 * @param {string[]} path	Path to add the collection index to.
	 * @return {string[]} 		New path including collection index (does not modify given path).
	 */
	private $maybeAddCollectionIndex(submozel:Mozel, path:string[]) {
		// Property changed in submozel
		let relation = path[0];
		const property = this.$property(relation as any);
		if(!property) {
			throw new Error(`Path does not exist on ${this.constructor.name}: ${path}`);
		}
		if(!(property.value instanceof Collection)) {
			return path;
		}
		const index = property.value.indexOf(submozel);

		// Put the relation with index in front of the path
		return [relation, index.toString(), ...path.slice(1)];
	}

	/**
	 * Notify that a property is about to change. Will set the current value for any relevant watchers, so they can
	 * compare the new value to the old value, and provide the old value to the handler.
	 *
	 * This just-in-time approach has the slight advantage that we don't have to keep copies of values that will
	 * never change.
	 *
	 * @param {string[]} path		The path at which the change occurred.
	 * @param {Mozel} [submozel] 	The direct submozel reporting the change.
	 */
	$notifyPropertyBeforeChange(path:string[], submozel?:Mozel) {
		if(submozel) {
			// If submozel is part of a collection, we should add its index in the collection to the path
			path = this.$maybeAddCollectionIndex(submozel, path);
		}
		const pathString = path.join('.');
		this.$watchers(pathString).forEach(watcher => {
			watcher.updateValues(pathString)
		});
		if(this.parent && this.relation) {
			this.parent.$notifyPropertyBeforeChange([this.relation, ...path], this);
		}
	}

	/**
	 * Notify that a property has changed. Will activate relevant watchers.
	 * @param {string[]} path		Path at which the property changed.
	 * @param {Mozel} [submozel]	The direct submozel reporting the change.
	 */
	$notifyPropertyChanged(path: string[], submozel?:Mozel) {
		if(submozel) {
			path = this.$maybeAddCollectionIndex(submozel, path);
		}
		const pathString = path.join('.');
		this.$watchers(pathString).forEach(watcher => {
			watcher.execute(pathString);
		});
		if (this.parent && this.relation) {
			this.parent.$notifyPropertyChanged([this.relation, ...path], this);
		}
	}

	/**
	 * Resolves the given reference, or its own if no data is provided and it's marked as one.
	 * @param ref
	 */
	$resolveReference(ref?: { gid: alphanumeric }) {
		if (!this.registry) return;

		if (!ref) {
			if (!this.isReference) {
				// Mozel is already resolved
				return this;
			}
			return this.registry.byGid(this.gid);
		}

		// Resolve provided reference
		return this.registry.byGid(ref.gid);
	}

	/**
	 * Resolves all reference Properties and Collections
	 */
	$resolveReferences() {
		forEach(this.properties, (property: Property, key: string) => {
			property.resolveReferences();
		});
	}

	/**
	 * Applies all defined defaults to the properties.
	 */
	$applyDefaults() {
		forEach(this.properties, (property: Property) => {
			property.applyDefault();
		});
	}

	/**
	 * Check if any property has received a different value than its default.
	 */
	$isDefault() {
		return !!find(this.properties, (property: Property) => {
			return !property.isDefault();
		});
	}

	/**
	 * Set only primitive properties from given data.
	 * @param {Data} properties
	 */
	$setPrimitiveProperties(properties: Data) {
		forEach(this.properties, (value: Property, key: string) => {
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
		forEach(this.properties, (property: Property, key: string) => {
			if (this.$isPrimitiveProperty(key)) {
				properties[key] = <primitive>this.properties[key].value;
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

		forEach(this.properties, (property: Property, key: string) => {
			if (!this.$isPrimitiveProperty(key)) {
				relations[key] = <ComplexValue>this.properties[key].value;
			}
		});
		return relations;
	}

	/**
	 * Check if the given property is a primitive.
	 * @param key
	 */
	$isPrimitiveProperty(key: string) {
		let type = this.properties[key].type;
		return !isMozelClass(type);
	}

	/**
	 * Checks if the Mozel has a property
	 * @param property
	 */
	$has(property: string) {
		return property in this.properties;
	}

	/**
	 * Export defined properties to a plain (nested) object.
	 * @return {Data}
	 */
	$export(): Data {
		let exported: Data = {};
		if (this.static.hasOwnProperty('type')) {
			exported._type = this.static.type; // using parent's type confuses any factory trying to instantiate based on this export
		}

		forEach(this.properties, (property: Property, name: string) => {
			let value = property.value;
			if (isComplexValue(value)) {
				exported[name] = value instanceof Mozel ? value.$export() : value.export();
				return;
			}
			exported[name] = value;
		});

		return exported;
	}

	/**
	 * Creates a deep clone of the mozel.
	 */
	$cloneDeep<T extends Mozel>() {
		return this.static.create(this.$export() as MozelData<T>);
	}

	/**
	 * Can disable strict type checking, so properties can have invalid values.
	 * When using the properties in non-strict mode, always use type checking at runtime. Typescript will not complain.
	 * @param strict
	 */
	set $strict(strict:boolean) {
		this.strict = strict;
	}

	get $strict():boolean {
		// Get
		if(this.strict === undefined && this.parent) {
			return this.parent.$strict;
		}
		return this.strict !== false;
	}

	/**
	 * Returns validation errors in the Mozel
	 * @param {boolean} deep	If set to `true`, will return all errors of all submozels recursively.
	 * 							Defaults to `false`, returning only errors of direct properties.
	 */
	get $errors() {
		const errors:Record<string, Error> = {};
		for(let name in this.properties) {
			const property = this.properties[name];
			if(property.error) {
				errors[name] = property.error;
			}
		}
		return errors;
	}

	$errorsDeep() {
		const errors = this.$errors;
		for(let name in this.properties) {
			const property = this.properties[name];
			if (isComplexValue(property.value)) {
				const subErrors = property.value instanceof Mozel ? property.value.$errorsDeep() : property.value.errorsDeep();
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

		forEach(this.properties, (property: Property, key: string) => {
			let value = property.value;
			if(value instanceof Mozel) {
				value.$renderTemplates(templater);
				return;
			}
			if(value instanceof Collection) {
				value.renderTemplates(templater);
			}
			if (isString(value)) {
				// Render template on string and set new value
				this.$set(key, templater.render(value));
				return;
			}
		});
	}

	// For override

	$name() {
		return this.static.type;
	}

	$plural() {
		return this.$name() + 's';
	}

	$uriPart() {
		return this.$plural().toLowerCase();
	}
}
