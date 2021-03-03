var Mozel_1;
import { __decorate, __param } from "tslib";
import "reflect-metadata";
import Property, { Alphanumeric, isComplexValue, isMozelClass } from './Property';
import Collection from './Collection';
import { find, forEach, get, isPlainObject, isString, cloneDeep } from 'lodash';
import Templater from './Templater';
import { inject, injectable, optional } from "inversify";
import { injectableMozel } from "./inversify";
import { MozelFactoryType } from "./MozelFactoryInterface";
import Registry from "./Registry";
import { LogLevel } from "log-control";
import log from "./log";
// re-export for easy import together with Mozel
export { Alphanumeric };
export { injectableMozel };
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
        this.isReference = false;
        this.mozelFactory = mozelFactory;
        this.registry = registry;
        this.watchers = [];
        this.define();
        // Check if subclass properly overrode defineData method.
        if (!('id' in this.properties)) {
            log.warn(`Modl property 'id' was not defined in mozel ${this.getMozelName()}. Perhaps defineData did not call super?`);
        }
        this.applyDefaults();
        this.init();
    }
    static get type() {
        return this.name; // Try using class name (will not work ben uglified).
    }
    ;
    /**
     * Access to the logging utility of Mozel, which allows to set log levels and drivers for different components.
     */
    static get log() {
        return log;
    }
    static injectable(container) {
        // Non-typescript alternative for decorator
        injectableMozel(container)(this);
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
        this.classPropertyDefinitions.push({ name, type: runtimeType, options });
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
        this.classCollectionDefinitions.push({ name, type: runtimeType, options });
    }
    /**
     * Instantiate a Mozel based on raw data.
     * @param {Data} [data]
     */
    static create(data) {
        // Instantiate this class.
        const mozel = new this();
        if (data) {
            mozel.setData(data, true);
        }
        return mozel;
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
            this._classPropertyDefinitions = [];
        }
        return this._classPropertyDefinitions;
    }
    /**
     * Definitions of Collections made at class level.
     */
    static get classCollectionDefinitions() {
        // Override _classPropertyDefinitions so this class has its own set and it will not add its properties to its parent
        if (!this.hasOwnProperty('_classCollectionDefinitions')) {
            this._classCollectionDefinitions = [];
        }
        return this._classCollectionDefinitions;
    }
    get static() {
        return this.constructor;
    }
    init() {
    } // for override
    /**
     * Instantiate a Mozel based on the given class and the data.
     * @param Class
     * @param data
     * @param root					If true, references will be resolved after creation.
     * @param asReference		If true, will not be registered.
     */
    create(Class, data, root = false, asReference = false) {
        if (this.mozelFactory) {
            // Preferably, use DI-injected factory
            return this.mozelFactory.create(Class, data, root, asReference);
        }
        // Otherwise, just create an instance of this class.
        return Class.create(data);
    }
    destroy() {
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
    setParent(parent, relation, lock = true) {
        if (this.parentLock) {
            throw new Error(this.static.name + " is locked to its parent and cannot be transferred.");
        }
        this.parent = parent;
        this.relation = relation;
        this.parentLock = lock;
    }
    /**
     * Get the Mozel's parent.
     */
    getParent() {
        return this.parent;
    }
    /**
     * Get the Mozel's relation to its parent.
     */
    getRelation() {
        return this.relation;
    }
    /**
     * @protected
     * For override. Any properties and collections of the mozel should be defined here.
     */
    define() {
        // To be called for each class on the prototype chain
        const _defineData = (Class) => {
            if (Class !== Mozel_1) {
                // Define class properties of parent class
                _defineData(Object.getPrototypeOf(Class));
            }
            // Define class properties of this class
            forEach(Class.classPropertyDefinitions, (property) => {
                this.defineProperty(property.name, property.type, property.options);
            });
            forEach(Class.classCollectionDefinitions, (collection) => {
                this.defineCollection(collection.name, collection.type, collection.options);
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
    defineProperty(name, type, options) {
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
     * @param {Mozel} [type]       						The class of the items in the Collection.
     * @param {CollectionOptions} [options]
     * @return {Collection}
     */
    defineCollection(relation, type, options) {
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
     * @param {boolean} init					If set to true, Mozels and Collections may be initialized from objects and arrays, respectively.
     */
    set(property, value, init = false) {
        if (!(property in this.properties)) {
            throw new Error(`Could not set non-existing property '${property}' on ${this.getMozelName()}.`);
        }
        this.properties[property].set(value, init);
        return true;
    }
    /**
     * Get type-safe value of the given property.
     * @param {string} property
     */
    get(property) {
        if (!(property in this.properties)) {
            throw new Error(`Could not get non-existing property '${property}' on ${this.getMozelName()}.`);
        }
        return this.properties[property].value;
    }
    /**
     * Get the Property object with the given name.
     * @param property
     */
    getProperty(property) {
        return this.properties[property];
    }
    /**
     * Sets all registered properties from the given data.
     * @param {object} data			The data to set into the mozel.
     * @param {boolean} [init]	If set to true, Mozels and Collections can be initialized from objects and arrays.
     */
    setData(data, init = false) {
        forEach(this.properties, (property, key) => {
            if (key in data) {
                this.set(key, data[key], init);
            }
        });
    }
    watch(watcher) {
        this.watchers.push(watcher);
        const currentValue = get(this, watcher.path);
        if (watcher.immediate) {
            Mozel_1.callWatcherHandler(watcher, get(this, watcher.path));
        }
        else {
            watcher.currentValue = currentValue;
        }
    }
    static callWatcherHandler(watcher, newValue) {
        if (watcher.type && !Property.checkType(newValue, watcher.type)) {
            throw new Error(`Property change event expected ${watcher.type}, ${typeof (newValue)} given.`);
        }
        watcher.handler(newValue, watcher.currentValue);
        watcher.currentValue = watcher.deep ? cloneDeep(watcher.currentValue) : watcher.currentValue;
    }
    ;
    propertyChanged(path, newValue, oldValue) {
        if (this.parent && this.relation) {
            const parentPath = [this.relation, ...path];
            this.parent.propertyChanged(parentPath, newValue, oldValue);
        }
        const pathStr = path.join('.');
        this.watchers.forEach(watcher => {
            // Simple case: the exact value we're watching changed
            if (pathStr === watcher.path) {
                Mozel_1.callWatcherHandler(watcher, newValue);
                return;
            }
            // Parent of watched property changed, check if new parent has new value at given path
            if (watcher.path.substring(0, pathStr.length) === pathStr) {
                const newWatcherValue = get(this, watcher.path);
                if (newWatcherValue !== watcher.currentValue) {
                    Mozel_1.callWatcherHandler(watcher, newWatcherValue);
                    watcher.currentValue = newWatcherValue;
                }
                return;
            }
            // Child of watched property changed (deep watching only)
            if (watcher.deep && pathStr.substring(0, watcher.path.length) === watcher.path) {
                Mozel_1.callWatcherHandler(watcher, get(this, watcher.path)); // cannot keep track of previous value without cloning
            }
        });
    }
    /**
     * Resolves the given reference, or its own if no data is provided and it's marked as one.
     * @param ref
     */
    resolveReference(ref) {
        if (!this.registry)
            return;
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
    resolveReferences() {
        forEach(this.properties, (property, key) => {
            property.resolveReferences();
        });
    }
    applyDefaults() {
        forEach(this.properties, (property) => {
            property.applyDefault();
        });
    }
    isDefault() {
        return !!find(this.properties, (property) => {
            return !property.isDefault();
        });
    }
    /**
     * Set only primitive properties from given data.
     * @param {Data} properties
     */
    setPrimitiveProperties(properties) {
        forEach(this.properties, (value, key) => {
            if (!(key in properties) || !this.isPrimitiveProperty(key)) {
                return;
            }
            this.set(key, value);
        });
    }
    /**
     * Checks if the Mozel has a property
     * @param property
     */
    hasProperty(property) {
        return property in this.properties;
    }
    /**
     * Get only primitive type properties.
     * @return {[key:string]:Primitive}
     */
    getPrimitiveProperties() {
        let properties = {};
        forEach(this.properties, (property, key) => {
            if (this.isPrimitiveProperty(key)) {
                properties[key] = this.properties[key].value;
            }
        });
        return properties;
    }
    /**
     * Get only complex type properties.
     * @return {[key:string]:ComplexValue}
     */
    getComplexProperties() {
        let relations = {};
        forEach(this.properties, (property, key) => {
            if (!this.isPrimitiveProperty(key)) {
                relations[key] = this.properties[key].value;
            }
        });
        return relations;
    }
    /**
     * Check if the given property is a primitive.
     * @param key
     */
    isPrimitiveProperty(key) {
        let type = this.properties[key].type;
        return !isMozelClass(type);
    }
    /**
     * Export defined properties to a plain (nested) object.
     * @return {Data}
     */
    export() {
        let exported = {};
        if (this.static.hasOwnProperty('type')) {
            exported._type = this.static.type; // using parent's type confuses any factory trying to instantiate based on this export
        }
        forEach(this.properties, (property, name) => {
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
     * Renders string templates in all properties of the Mozel, recursively.
     * @param {Templater|object} templater	A Templater to use to render the templates, or a data object to fill in the values.
     * 																			If a data object is provided, a new Templater will be instantiated with that data object.
     */
    renderTemplates(templater) {
        if (!(templater instanceof Templater)) {
            // Instantiate new Templater with given data.
            templater = new Templater(templater);
        }
        forEach(this.properties, (property, key) => {
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
    getMozelName() {
        return this.static.type;
    }
    getMozelPlural() {
        return this.getMozelName() + 's';
    }
    getURIPart() {
        return this.getMozelPlural().toLowerCase();
    }
};
Mozel._classPropertyDefinitions = [];
Mozel._classCollectionDefinitions = [];
__decorate([
    property(Alphanumeric)
], Mozel.prototype, "id", void 0);
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