var Mozel_1;
import { __decorate, __param } from "tslib";
import "reflect-metadata";
import Property, { Alphanumeric, isComplexValue, isMozelClass } from './Property';
import Collection from './Collection';
import { concat, find, forEach, get, isPlainObject, isString, remove, map } from 'lodash';
import Templater from './Templater';
import { inject, injectable, optional } from "inversify";
import { MozelFactoryType } from "./MozelFactoryInterface";
import Registry from "./Registry";
import { isSubClass } from 'validation-kit';
import { LogLevel } from "log-control";
import log from "./log";
import PropertyWatcher from "./PropertyWatcher";
import MozelFactory from "./MozelFactory";
import EventInterface, { Event } from "event-interface-mixin";
// re-export for easy import together with Mozel
export { Alphanumeric };
export { LogLevel };
// TYPE GUARDS
export function isData(value) {
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
export function property(runtimeType, options) {
    return function (target, propertyName) {
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
export function collection(runtimeType, options) {
    return function (target, propertyName) {
        target.static.defineClassCollection(propertyName, runtimeType, options);
    };
}
// Some keywords that can shorten property declarations from e.g. {required:true} to {required}
export const required = true;
export const immediate = true;
export const deep = true;
export const reference = true;
export function schema(MozelClass) {
    return MozelClass.$schema();
}
export const $s = schema; // shorter alias
export class DestroyedEvent extends Event {
}
/**
 * Mozel class providing runtime type checking and can be exported and imported to and from plain objects.
 */
let Mozel = Mozel_1 = class Mozel {
    constructor(mozelFactory, registry) {
        this.properties = {};
        this.parent = null;
        this.parentLock = false;
        this.relation = null;
        this.gid = 0; // a non-database ID that can be used to reference other mozels
        this.$destroyed = false;
        this.$isReference = false;
        this.$events = new EventInterface();
        this.$on = this.$events.getOnMethod();
        this.$off = this.$events.getOffMethod();
        /**
         * Alias of $property
         */
        this.$ = this.$property;
        this.factory = mozelFactory;
        this.registry = registry;
        this.watchers = [];
        this.$define();
        this.$applyDefaults();
        this.$init();
    }
    static get type() {
        return this.name; // Try using class name (will not work when uglified).
    }
    ;
    static test(ExpectedClass, data) {
        return new ExpectedClass();
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
    static getPropertyDefinition(key) {
        if (key in this.classPropertyDefinitions) {
            return this.classPropertyDefinitions[key];
        }
        const Parent = Object.getPrototypeOf(this);
        if (!isSubClass(Parent, Mozel_1)) {
            return undefined;
        }
        return Parent.getPropertyDefinition(key);
    }
    static getCollectionDefinition(key) {
        if (key in this.classCollectionDefinitions) {
            return this.classCollectionDefinitions[key];
        }
        const Parent = Object.getPrototypeOf(this);
        if (!isSubClass(Parent, Mozel_1)) {
            return undefined;
        }
        return Parent.getCollectionDefinition(key);
    }
    /**
     * Get this Mozel's schema.
     * @param {SchemaDefinition} [definition]	The definition from the parent's
     */
    static $schema(definition) {
        function schemaFromDefinition(definition) {
            const pathArray = definition.path;
            const path = pathArray.join('.');
            return {
                $type: definition.type,
                $reference: definition.reference,
                $required: definition.required,
                $pathArray: pathArray,
                $path: path,
                $: path,
                $collection: definition.collection
            };
        }
        return new Proxy(this, {
            get(target, key) {
                // Current schema (based on parent definition, if provided)
                if (!definition) {
                    // Default starting 'definition'
                    definition = { type: target, required: false, reference: false, collection: false, path: [] };
                }
                if (!isString(key)) {
                    return undefined;
                }
                // For $-properties, return schema definition
                if (key.substring(0, 1) === '$') {
                    const schema = schemaFromDefinition(definition);
                    return schema[key];
                }
                // Try sub-properties
                let def, collection = false;
                def = target.getPropertyDefinition(key);
                if (!def) {
                    def = target.getCollectionDefinition(key);
                    collection = true;
                }
                if (!def) {
                    throw new Error(`Mozel path does not exist: ${[...definition.path, key]}`);
                }
                const subDefinition = {
                    type: def.type,
                    reference: get(def, 'options.required', false),
                    required: get(def, 'options.required', false),
                    collection: collection,
                    path: [...definition.path, key]
                };
                if (isSubClass(def.type, Mozel_1)) {
                    const SubType = def.type;
                    return SubType.$schema(subDefinition);
                }
                else {
                    // Cannot go deeper because next level is not a Mozel
                    return schemaFromDefinition(subDefinition);
                }
            }
        });
    }
    static $(definition) {
        return this.$schema(definition);
    }
    /**
     * Define a property for the mozel.
     * @param {string} name					Name of the property
     * @param {PropertyType} [runtimeType]	Type to check at runtime
     * @param {PropertyOptions} [options]
     */
    static property(name, runtimeType, options) {
        return this.defineClassProperty(name, runtimeType, options);
    }
    static defineClassProperty(name, runtimeType, options) {
        this.classPropertyDefinitions[name] = { name, type: runtimeType, options };
    }
    /**
     * Define a collection for the mozel.
     * @param {string} name					Name of the collection
     * @param {CollectionType} runtimeType	Type to check on the items in the collection
     * @param {CollectionOptions} options
     */
    static collection(name, runtimeType, options) {
        return this.defineClassCollection(name, runtimeType, options);
    }
    static defineClassCollection(name, runtimeType, options) {
        this.classCollectionDefinitions[name] = { name, type: runtimeType, options };
    }
    /**
     * Instantiate a Mozel based on raw data.
     * @param {Data} [data]
     */
    static create(data) {
        const factory = this.createFactory();
        return factory.create(this, data);
    }
    static getParentClass() {
        return Object.getPrototypeOf(this);
    }
    /**
     * Definitions of Properties made at class level.
     */
    static get classPropertyDefinitions() {
        // Override _classPropertyDefinitions so this class has its own set and it will not add its properties to its parent
        if (!this.hasOwnProperty('_classPropertyDefinitions')) {
            this._classPropertyDefinitions = {};
        }
        return this._classPropertyDefinitions;
    }
    /**
     * Definitions of Collections made at class level.
     */
    static get classCollectionDefinitions() {
        // Override _classPropertyDefinitions so this class has its own set and it will not add its properties to its parent
        if (!this.hasOwnProperty('_classCollectionDefinitions')) {
            this._classCollectionDefinitions = {};
        }
        return this._classCollectionDefinitions;
    }
    get static() {
        return this.constructor;
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
     * @param asReference		If true, will not be registered.
     */
    $create(Class, data, asReference = false) {
        if (this.factory) {
            // Preferably, use DI-injected factory
            return this.factory.create(Class, data, asReference);
        }
        // Otherwise, just create an instance of this class.
        return Class.create(data);
    }
    $destroy() {
        this.$destroyed = true;
        // First remove watchers to avoid confusing them with the break-down
        this.watchers.splice(0, this.watchers.length);
        if (this.$parent) {
            this.$parent.$remove(this);
        }
        if (this.factory) {
            this.factory.destroy(this);
        }
        this.$forEachChild(mozel => mozel.$destroy());
        this.$events.fire(new DestroyedEvent());
    }
    /**
     * Set the Mozel's parent Mozel.
     * @param {Mozel} parent			The parent this Mozel is a child of.
     * @param {string} relation			The name of the parent-child relationship.
     * @param {boolean} lock			Locks the Mozel to the parent, so it cannot be transferred to another parent.
     */
    $setParent(parent, relation, lock = false) {
        if (this.parentLock) {
            throw new Error(this.static.name + " is locked to its parent and cannot be transferred.");
        }
        if (this.parent) {
            this.parent.$remove(this);
        }
        this.parent = parent;
        this.relation = relation;
        this.parentLock = lock;
    }
    $remove(child, includeReferences = false) {
        for (let key in this.$properties) {
            const property = this.$properties[key];
            if (!includeReferences && property.isReference)
                continue;
            if (property.type === Collection) {
                property.value.remove(child);
            }
            else if (property.value === child) {
                property.set(undefined);
            }
        }
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
        const _defineData = (Class) => {
            if (Class !== Mozel_1) {
                // Define class properties of parent class
                _defineData(Object.getPrototypeOf(Class));
            }
            // Define class properties of this class
            forEach(Class.classPropertyDefinitions, (property) => {
                this.$defineProperty(property.name, property.type, property.options);
            });
            forEach(Class.classCollectionDefinitions, (collection) => {
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
    $defineProperty(name, type, options) {
        let property = new Property(this, name, type, options);
        this.properties[name] = property;
        // Create getter/setter
        let currentValue = get(this, name);
        Object.defineProperty(this, name, {
            get: () => this.$get(name),
            set: value => this.$set(name, value, false),
            configurable: true
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
    $defineCollection(relation, type, options) {
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
     * @param {boolean} merge					If set to true, Mozels will be kept if gid did not change; data will be set instead
     */
    $set(property, value, init = true, merge = false) {
        if (!(property in this.properties)) {
            throw new Error(`Could not set non-existing property '${property}' on ${this.$name}.`);
        }
        this.properties[property].set(value, init, merge);
        return this.properties[property].value;
    }
    /**
     * Get type-safe value of the given property.
     * @param {string} property
     */
    $get(property) {
        if (property === '')
            return this;
        if (!(property in this.properties)) {
            throw new Error(`Could not get non-existing property '${property}' on ${this.$name}.`);
        }
        return this.properties[property].value;
    }
    /**
     * Get the Property object with the given name.
     * @param property
     */
    $property(property) {
        return this.properties[property];
    }
    /**
     * Get value at given path (not type-safe).
     * @param path
     */
    $path(path) {
        if (isString(path)) {
            path = path.split('.');
        }
        if (path.length === 0)
            return this;
        const step = this.$get(path[0]);
        if (path.length === 1)
            return step;
        if (step instanceof Collection) {
            return step.path(path.slice(1));
        }
        if (step instanceof Mozel_1) {
            return step.$path(path.slice(1));
        }
        return undefined;
    }
    /**
     * Gets all path values mathing the given path pattern.
     * @param {string|string[]} pathPattern	Path pattern to match. May include wildcards ('*').
     * @param {string[]} startingPath		Path to prepend to the resulting paths. Used for recursion.
     */
    $pathPattern(pathPattern, startingPath = []) {
        if (isString(pathPattern)) {
            pathPattern = pathPattern.split('.');
        }
        if (pathPattern.length === 0)
            return { [startingPath.join('.')]: this };
        const step = pathPattern[0];
        const properties = step === '*' ? Object.keys(this.properties) : [step];
        if (pathPattern.length === 1) {
            let values = {};
            for (let name of properties) {
                values = {
                    ...values,
                    [concat(startingPath, name).join('.')]: this.$get(name)
                };
            }
            return values;
        }
        // Path length > 1
        let values = {};
        for (let name of properties) {
            const value = this.$get(name);
            if (!isComplexValue(value)) {
                continue; // cannot continue on this path
            }
            const subValues = value instanceof Mozel_1
                ? value.$pathPattern(pathPattern.slice(1), [...startingPath, name])
                : value.pathPattern(pathPattern.slice(1), [...startingPath, name]);
            values = {
                ...values,
                ...subValues
            };
        }
        return values;
    }
    $getPath() {
        return this.$getPathArray().join('.');
    }
    $getPathArray() {
        if (!this.parent || !this.relation) {
            return [];
        }
        return [...this.parent.$getPathArray(), this.relation];
    }
    $getPathFrom(mozel) {
        return this.$getPathArrayFrom(mozel).join('.');
    }
    $getPathArrayFrom(mozel) {
        if (this === mozel)
            return [];
        if (!this.parent || !this.relation)
            throw new Error("No path from given Mozel found.");
        return [...this.parent.$getPathArrayFrom(mozel), this.relation];
    }
    /**
     * Sets all registered properties from the given data.
     * @param {object} data			The data to set into the mozel.
     * @param {boolean} merge		If set to `true`, only defined keys will be set.
     */
    $setData(data, merge = false) {
        forEach(this.properties, (property, key) => {
            if (!merge || key in data) {
                this.$set(key, data[key], true, merge);
            }
        });
    }
    /**
     * Watch changes to the given path.
     * @param {PropertyWatcherOptionsArgument} options
     */
    $watch(path, handler, options) {
        const finalPath = isString(path) ? path : path.$path;
        const allOptions = {
            ...options,
            ...{
                path: finalPath,
                handler: handler
            }
        };
        const watcher = new PropertyWatcher(this, allOptions);
        this.$addWatcher(watcher);
        return watcher;
    }
    /**
     * Get watchers matching the given path.
     * @param {string} path
     */
    $watchers(path) {
        return this.watchers.filter(watcher => watcher.matches(path));
    }
    $addWatcher(watcher) {
        this.watchers.push(watcher);
        if (watcher.immediate)
            watcher.execute(watcher.path);
    }
    $removeWatcher(watcher) {
        remove(this.watchers, w => w === watcher);
    }
    /**
     * If the given submozel is part of a collection of this mozel, will add the collection index of the submozel to
     * the given path.
     *
     * @param {Mozel} submozel	Direct submozel.
     * @param {string[]} path	Path to add the collection index to.
     * @return {string[]} 		New path including collection index (does not modify given path).
     */
    $maybeAddCollectionIndex(submozel, path) {
        // Property changed in submozel
        let relation = path[0];
        const property = this.$property(relation);
        if (!property) {
            throw new Error(`Path does not exist on ${this.constructor.name}: ${path}`);
        }
        if (!(property.value instanceof Collection)) {
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
    $notifyPropertyBeforeChange(path, submozel) {
        if (submozel) {
            // If submozel is part of a collection, we should add its index in the collection to the path
            path = this.$maybeAddCollectionIndex(submozel, path);
        }
        const pathString = path.join('.');
        this.$watchers(pathString).forEach(watcher => {
            watcher.updateValues(pathString);
        });
        if (this.parent && this.relation) {
            this.parent.$notifyPropertyBeforeChange([this.relation, ...path], this);
        }
    }
    /**
     * Notify that a property has changed. Will activate relevant watchers.
     * @param {string[]} path		Path at which the property changed.
     * @param {Mozel} [submozel]	The direct submozel reporting the change.
     */
    $notifyPropertyChanged(path, submozel) {
        if (submozel) {
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
    $resolveReference(ref) {
        if (!this.registry)
            return;
        if (!ref) {
            if (!this.$isReference) {
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
        forEach(this.properties, (property, key) => {
            property.resolveReferences();
        });
    }
    /**
     * Applies all defined defaults to the properties.
     */
    $applyDefaults() {
        forEach(this.properties, (property) => {
            property.applyDefault();
        });
    }
    /**
     * Check if any property has received a different value than its default.
     */
    $isDefault() {
        return !!find(this.properties, (property) => {
            return !property.isDefault();
        });
    }
    /**
     * Set only primitive properties from given data.
     * @param {Data} properties
     */
    $setPrimitiveProperties(properties) {
        forEach(this.properties, (value, key) => {
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
        let properties = {};
        forEach(this.properties, (property, key) => {
            if (this.$isPrimitiveProperty(key)) {
                properties[key] = this.properties[key].value;
            }
        });
        return properties;
    }
    /**
     * Get only complex type properties.
     * @return {[key:string]:ComplexValue}
     */
    $getComplexProperties() {
        let relations = {};
        forEach(this.properties, (property, key) => {
            if (!this.$isPrimitiveProperty(key)) {
                relations[key] = this.properties[key].value;
            }
        });
        return relations;
    }
    /**
     * Check if the given property is a primitive.
     * @param key
     */
    $isPrimitiveProperty(key) {
        let type = this.properties[key].type;
        return !isMozelClass(type) && type !== Collection;
    }
    /**
     * Checks if the Mozel has a property
     * @param property
     */
    $has(property) {
        return property in this.properties;
    }
    $eachProperty(callback) {
        for (let name in this.$properties) {
            callback(this.$properties[name]);
        }
    }
    $mapProperties(callback) {
        return map(this.$properties, callback);
    }
    /**
     * Export defined properties to a plain (nested) object.
     * @return {Data}
     */
    $export() {
        let exported = {};
        if (this.static.hasOwnProperty('type')) {
            exported._type = this.static.type; // using parent's type confuses any factory trying to instantiate based on this export
        }
        forEach(this.properties, (property, name) => {
            let value = property.value;
            if (isComplexValue(value)) {
                exported[name] = value instanceof Mozel_1 ? value.$export() : value.export();
                return;
            }
            exported[name] = value;
        });
        return exported;
    }
    /**
     * Creates a deep clone of the mozel.
     */
    $cloneDeep() {
        return this.static.create(this.$export());
    }
    /**
     * Can disable strict type checking, so properties can have invalid values. Errors will be stored in the Properties
     * with invalid states.
     * When using the properties in non-strict mode, always use type checking at runtime. Typescript will not complain.
     * @param strict
     */
    set $strict(strict) {
        this.strict = strict;
    }
    get $strict() {
        // Get
        if (this.strict === undefined && this.parent) {
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
        const errors = {};
        for (let name in this.properties) {
            const property = this.properties[name];
            if (property.error) {
                errors[name] = property.error;
            }
        }
        return errors;
    }
    $errorsDeep() {
        const errors = this.$errors;
        for (let name in this.properties) {
            const property = this.properties[name];
            if (isComplexValue(property.value)) {
                const subErrors = property.value instanceof Mozel_1 ? property.value.$errorsDeep() : property.value.errorsDeep();
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
    $renderTemplates(templater) {
        if (!(templater instanceof Templater)) {
            // Instantiate new Templater with given data.
            templater = new Templater(templater);
        }
        forEach(this.properties, (property, key) => {
            let value = property.value;
            if (value instanceof Mozel_1) {
                value.$renderTemplates(templater);
                return;
            }
            if (value instanceof Collection) {
                value.renderTemplates(templater);
            }
            if (isString(value)) {
                // Render template on string and set new value
                this.$set(key, templater.render(value));
                return;
            }
        });
    }
    $forEachChild(callback) {
        forEach(this.properties, (property, key) => {
            if (property.value instanceof Mozel_1) {
                return callback(property.value, key);
            }
            if (property.value instanceof Collection) {
                if (!property.value.isMozelType())
                    return;
                return property.value.each((mozel, index) => callback(mozel, key + "." + index));
            }
        });
    }
    // For override
    get $name() {
        return `${this.static.type} (${this.gid})`;
    }
};
Mozel._classPropertyDefinitions = {};
Mozel._classCollectionDefinitions = {};
__decorate([
    property(Alphanumeric, { required })
], Mozel.prototype, "gid", void 0);
Mozel = Mozel_1 = __decorate([
    injectable(),
    __param(0, inject(MozelFactoryType)), __param(0, optional()),
    __param(1, inject(Registry)), __param(1, optional())
], Mozel);
export default Mozel;
//# sourceMappingURL=Mozel.js.map