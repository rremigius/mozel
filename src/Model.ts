import "reflect-metadata";

import Property, {
	Alphanumeric,
	ComplexValue,
	isComplexValue,
	isModelClass,
	ModelClass,
	PropertyInput,
	PropertyOptions,
	PropertyType,
	PropertyValue
} from './Property';
import Collection, {CollectionOptions, CollectionType} from './Collection';

import {find, forEach, get, isPlainObject, isString} from 'lodash';

import Templater from '@/Templater';
import {inject, injectable, optional} from "inversify";
import {injectableModel} from "@/inversify";
import ModelFactoryInterface, {ModelFactoryType} from "@/ModelFactoryInterface";
import Registry from "@/Registry";
import {alphanumeric, primitive} from 'validation-kit';

// TYPES

export type Data = { [key: string]: any }; // General-purpose plain object
export type ModelConstructor<T extends Model> = {
	new(...args: any[]): T;
	type: string;
};
export type PropertyWatcher<T extends PropertyValue> = {
	path: string,
	type?: PropertyType,
	immediate?: boolean,
	deep?: boolean,
	currentValue?: T,
	handler: (newValue: T, oldValue: T) => void
};

// Types for Model creation by plain object
export type PropertyKeys<T extends Model> = { [K in keyof T]: T[K] extends PropertyValue ? K : never }[keyof T];
export type CollectionData<T> = T extends Model ? ModelData<T>[] : T extends primitive ? T[] | Collection<T> : never;
export type PropertyData<T> =
	T extends PropertyValue
		? T extends Model
		? ModelData<T>
		: T extends Collection<infer C>
			? CollectionData<C>
			: T
		: false; // not a PropertyValue
export type ModelData<T extends Model> = T extends { ModelDataType: any }
	? T['ModelDataType'] : { [K in PropertyKeys<T>]?: PropertyData<T[K]> };

type PropertyDefinition = { name: string, type?: PropertyType, options?: PropertyOptions };
type CollectionDefinition = { name: string, type?: CollectionType, options?: CollectionOptions };

// re-export for easy import together with Model
export {Alphanumeric, alphanumeric, ModelClass};
export {injectableModel};

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
	return function (target: Model, propertyName: string) {
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
	return function (target: Model, propertyName: string) {
		target.static.defineClassCollection(propertyName, runtimeType, options);
	};
}

// Some keywords that can shorten property declarations from e.g. {required:true} to {required}
export const required = true;
export const immediate = true;
export const deep = true;
export const reference = true;


/**
 * Model class providing runtime type checking and can be exported and imported to and from plain objects.
 */
@injectable()
export default class Model {
	public _type?: string; // just for ModelData typing
	static get type() {
		return this.name; // Try using class name (will not work ben uglified).
	};

	private static _classPropertyDefinitions: (PropertyDefinition)[] = [];
	private static _classCollectionDefinitions: (CollectionDefinition)[] = [];

	// Injected properties
	private readonly modelFactory?: ModelFactoryInterface;
	private readonly registry?: Registry<Model>;

	private properties: Record<string, Property> = {};

	private parent: Model | null = null;
	private parentLock: boolean = false;
	private relation: string | null = null;

	private readonly watchers: PropertyWatcher<PropertyValue>[];

	@property(Alphanumeric)
	id?: alphanumeric;
	@property(Alphanumeric, {required})
	gid: alphanumeric = 0; // a non-database ID that can be used to reference other models

	isReference: boolean = false;

	static defineClassProperty(name: string, runtimeType?: PropertyType, options?: PropertyOptions) {
		this.classPropertyDefinitions.push({name, type: runtimeType, options});
	}

	static defineClassCollection(name: string, runtimeType?: CollectionType, options?: CollectionOptions) {
		this.classCollectionDefinitions.push({name, type: runtimeType, options});
	}

	/**
	 * Instantiate a Model based on raw data.
	 * @param {Data} [data]
	 */
	static create(data?: Data): Model {
		// Instantiate this class.
		const model = new this();
		if (data) {
			model.setData(data, true);
		}
		return model;
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
		@inject(ModelFactoryType) @optional() modelFactory?: ModelFactoryInterface,
		@inject(Registry) @optional() registry?: Registry<Model>
	) {
		this.modelFactory = modelFactory;
		this.registry = registry;
		this.watchers = [];

		this.defineData();

		// Check if subclass properly overrode defineData method.
		if (!('id' in this.properties)) {
			console.warn(`Modl property 'id' was not defined in model ${this.getModelName()}. Perhaps defineData did not call super?`);
		}

		this.applyDefaults();

		this.init();
	}

	get static(): typeof Model {
		return <typeof Model>this.constructor;
	}

	init() {
	} // for override

	/**
	 * Instantiate a Model based on the given class and the data.
	 * @param Class
	 * @param data
	 * @param root					If true, references will be resolved after creation.
	 * @param asReference		If true, will not be registered.
	 */
	create(Class: ModelClass, data?: Data, root: boolean = false, asReference: boolean = false) {
		if (this.modelFactory) {
			// Preferably, use DI-injected factory
			return this.modelFactory.create(Class, data, root, asReference);
		}
		// Otherwise, just create an instance of this class.
		return Class.create(data);
	}

	destroy() {
		if (this.modelFactory) {
			this.modelFactory.destroy(this);
		}
	}

	/**
	 * Set the Model's parent Model.
	 * @param {Model} parent			The parent this Model is a child of.
	 * @param {string} relation			The name of the parent-child relationship.
	 * @param {boolean} lock			Locks the Model to the parent, so it cannot be transferred to another parent.
	 */
	setParent(parent: Model, relation: string, lock: boolean = true) {
		if (this.parentLock) {
			throw new Error(this.static.name + " is locked to its parent and cannot be transferred.");
		}
		this.parent = parent;
		this.relation = relation;
		this.parentLock = lock;
	}

	/**
	 * Get the Model's parent.
	 */
	getParent() {
		return this.parent;
	}

	/**
	 * Get the Model's relation to its parent.
	 */
	getRelation() {
		return this.relation;
	}

	/**
	 * @protected
	 * For override. Any properties and collections of the model should be defined here.
	 */
	defineData() {
		// To be called for each class on the prototype chain
		const _defineData = (Class: ModelClass) => {
			if (Class !== Model) {
				// Define class properties of parent class
				_defineData(Object.getPrototypeOf(Class));
			}
			// Define class properties of this class
			forEach(Class.classPropertyDefinitions, (property: PropertyDefinition) => {
				this.defineProperty(property.name, property.type, property.options);
			});
			forEach(Class.classCollectionDefinitions, (collection: CollectionDefinition) => {
				this.defineCollection(collection.name, collection.type, collection.options);
			});
		};
		_defineData(this.static);
	}

	/**
	 * Defines a property to be part of the Model's data. Only defined properties will be exported and imported
	 * to and from plain objects and arrays. A getter and setter will be created, overwriting the original property.
	 *
	 * @param {string} name							The name of the property.
	 * @param {PropertyType} type				The runtime type of the property. Can be one of the following values:
	 * 																	Number, String, Alphanumeric, Boolean, (subclass of) Model, Collection or undefined.
	 * @param {PropertyOptions} [options]
	 */
	defineProperty(name: string, type?: PropertyType, options?: PropertyOptions) {
		let property = new Property(this, name, type, options);
		this.properties[name] = property;

		// Create getter/setter
		let currentValue = get(this, name);
		Object.defineProperty(this, name, {
			get: () => this.get(name),
			set: value => this.set(name, value)
		});
		// Preset value
		if (currentValue !== undefined) {
			this.set(name, currentValue);
		}
		return property;
	}

	/**
	 * Defines a property and instantiates it as a Collection.
	 * @param {string} relation       				The relation name.
	 * @param {Model} [type]       						The class of the items in the Collection.
	 * @param {CollectionOptions} [options]
	 * @return {Collection}
	 */
	defineCollection(relation: string, type?: CollectionType, options?: CollectionOptions) {
		let collection = new Collection(this, relation, type);
		collection.isReference = (options && options.reference) === true;

		this.defineProperty(relation, Collection, {
			required: true,
			default: collection
		});
		return collection;
	}

	/**
	 * Set value with type checking.
	 * @param {string} property				The name of the property
	 * @param {PropertyInput} value		The value to set on the property
	 * @param {boolean} init					If set to true, Models and Collections may be initialized from objects and arrays, respectively.
	 */
	set(property: string, value: PropertyInput, init = false) {
		if (!(property in this.properties)) {
			throw new Error(`Could not set non-existing property '${property}' on ${this.getModelName()}.`);
		}
		this.properties[property].set(value, init);
		return true;
	}

	/**
	 * Get type-safe value of the given property.
	 * @param {string} property
	 */
	get(property: string) {
		if (!(property in this.properties)) {
			throw new Error(`Could not get non-existing property '${property}' on ${this.getModelName()}.`);
		}
		return this.properties[property].value;
	}

	/**
	 * Get the Property object with the given name.
	 * @param property
	 */
	getProperty(property: string) {
		return this.properties[property];
	}

	/**
	 * Sets all registered properties from the given data.
	 * @param {object} data			The data to set into the model.
	 * @param {boolean} [init]	If set to true, Models and Collections can be initialized from objects and arrays.
	 */
	setData(data: Data, init = false) {
		forEach(this.properties, (property: Property, key: string) => {
			if (key in data) {
				this.set(key, data[key], init);
			}
		});
	}

	watch(watcher: PropertyWatcher<PropertyValue>) {
		this.watchers.push(watcher);
		if (watcher.immediate) {
			Model.callWatcherHandler(watcher, get(this, watcher.path), undefined);
		}
	}

	private static callWatcherHandler(watcher: PropertyWatcher<PropertyValue>, newValue: PropertyValue, oldValue: PropertyValue) {
		if (watcher.type && !Property.checkType(newValue, watcher.type)) {
			throw new Error(`Property change event expected ${watcher.type}, ${typeof (newValue)} given.`);
		}
		return watcher.handler(newValue, oldValue);
	};

	propertyChanged(path: string[], newValue: PropertyValue, oldValue: PropertyValue) {
		if (this.parent && this.relation) {
			const parentPath = [this.relation, ...path];
			this.parent.propertyChanged(parentPath, newValue, oldValue);
		}

		const pathStr = path.join('.');
		this.watchers.forEach(watcher => {
			// Simple case: the exact value we're watching changed
			if (pathStr === watcher.path) {
				Model.callWatcherHandler(watcher, newValue, oldValue);
				return;
			}

			// Parent of watched property changed, check if new parent has new value at given path
			if (watcher.path.substring(0, pathStr.length) === pathStr) {
				const newWatcherValue = get(this, watcher.path);
				if (newWatcherValue !== watcher.currentValue) {
					Model.callWatcherHandler(watcher, newWatcherValue, watcher.currentValue);
					watcher.currentValue = newWatcherValue;
				}
				return;
			}

			// Child of watched property changed (deep watching only)
			if (watcher.deep && pathStr.substring(0, watcher.path.length) === watcher.path) {
				Model.callWatcherHandler(watcher, get(this, watcher.path), undefined); // cannot keep track of previous value without cloning
			}
		});
	}

	/**
	 * Resolves the given reference, or its own if no data is provided and it's marked as one.
	 * @param ref
	 */
	resolveReference<Model>(ref?: { gid: alphanumeric }) {
		if (!this.registry) return;

		if (!ref) {
			if (!this.isReference) {
				// Model is already resolved
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
	resolveReferences() {
		forEach(this.properties, (property: Property, key: string) => {
			property.resolveReferences();
		});
	}

	applyDefaults() {
		forEach(this.properties, (property: Property) => {
			property.applyDefault();
		});
	}

	isDefault() {
		return !!find(this.properties, (property: Property) => {
			return !property.isDefault();
		});
	}

	/**
	 * Set only primitive properties from given data.
	 * @param {Data} properties
	 */
	setPrimitiveProperties(properties: Data) {
		forEach(this.properties, (value: Property, key: string) => {
			if (!(key in properties) || !this.isPrimitiveProperty(key)) {
				return;
			}
			this.set(key, value);
		});
	}

	/**
	 * Checks if the Model has a property
	 * @param property
	 */
	hasProperty(property: string) {
		return property in this.properties;
	}

	/**
	 * Get only primitive type properties.
	 * @return {[key:string]:Primitive}
	 */
	getPrimitiveProperties() {
		let properties: { [key: string]: primitive } = {};
		forEach(this.properties, (property: Property, key: string) => {
			if (this.isPrimitiveProperty(key)) {
				properties[key] = <primitive>this.properties[key].value;
			}
		});
		return properties;
	}

	/**
	 * Get only complex type properties.
	 * @return {[key:string]:ComplexValue}
	 */
	getComplexProperties() {
		let relations: { [key: string]: ComplexValue } = {};

		forEach(this.properties, (property: Property, key: string) => {
			if (!this.isPrimitiveProperty(key)) {
				relations[key] = <ComplexValue>this.properties[key].value;
			}
		});
		return relations;
	}

	/**
	 * Check if the given property is a primitive.
	 * @param key
	 */
	isPrimitiveProperty(key: string) {
		let type = this.properties[key].type;
		return !isModelClass(type);
	}

	/**
	 * Export defined properties to a plain (nested) object.
	 * @return {Data}
	 */
	export(): Data {
		let exported: Data = {};
		if (this.static.hasOwnProperty('type')) {
			exported._type = this.static.type; // using parent's type confuses any factory trying to instantiate based on this export
		}

		forEach(this.properties, (property: Property, name: string) => {
			let value = property.value;
			if (isComplexValue(value)) {
				exported[name] = value.export();
				return;
			}
			exported[name] = value;
		});

		return exported;
	}

	/**
	 * Renders string templates in all properties of the Model, recursively.
	 * @param {Templater|object} templater	A Templater to use to render the templates, or a data object to fill in the values.
	 * 																			If a data object is provided, a new Templater will be instantiated with that data object.
	 */
	renderTemplates(templater: Templater | Data) {
		if (!(templater instanceof Templater)) {
			// Instantiate new Templater with given data.
			templater = new Templater(templater);
		}

		forEach(this.properties, (property: Property, key: string) => {
			let value = property.value;
			if (isComplexValue(value)) {
				value.renderTemplates(templater);
				return;
			}
			if (isString(value)) {
				// Render template on string and set new value
				this.set(key, templater.render(value));
				return;
			}
		});
	}

	// For override

	getModelName() {
		return this.static.type;
	}

	getModelPlural() {
		return this.getModelName() + 's';
	}

	getURIPart() {
		return this.getModelPlural().toLowerCase();
	}
}
