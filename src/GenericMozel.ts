import Mozel, {Data, MozelData} from './Mozel';
import Property from "./Property";
import {forEach, mapValues} from 'lodash';

/**
 * GenericMozel can take any number of Primitive Properties, which can be defined on the fly.
 * Any keys passed to the `create` argument object, or defined after construction, are initialized as Properties,
 * will be validated as undefined Primitive types, and will be exported in the `export()` method.
 *
 */
export default class GenericMozel<K extends Data = Data> extends Mozel {
	[key:string]:any;

	MozelDataType:{[I in keyof K]?:K[I]} = {};

	private genericProperties:Record<string,Property> = {};

	static create<T extends Mozel>(data?:Data):T {
		// Cannot use `K` in static method unfortunately
		let mozel = <GenericMozel<any>><unknown>super.create(data);
		if(!data) {
			// TS ignore: 'GenericMozel<any>' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint 'Mozel'.
			return <T><unknown>mozel;
		}

		for(let key in data) {
			mozel.initProperty(key);
		}
		// Try again, with defined properties
		mozel.$setData(data);
		return <T><unknown>mozel;
	}

	initialized = false;

	constructor() {
		super();
		// All inherited properties and methods have been set; for all future properties, define Properties.
		this.initialized = true;
		return new Proxy(this, {
			get: (target:GenericMozel<K>, name:string) => {
				return target[name];
			},
			set: (target:GenericMozel<K>, name:string, value:any) => {
				// Still in constructor procedure, or property exists; act like a normal class.
				if(!this.initialized || name in target) {
					target[name] = value;
					return true;
				}
				// After initialization, initialize Property for every property set.
				if(this.initProperty(name)) {
					this.$set(name, value);
					return true;
				}
				// Unable to initialize Property
				return false;
			}
		});
	}

	/**
	 * Sets a Property value on the GenericMozel. If the Property did not exist, it will be initialized first.
	 * @param {string} property
	 * @param value
	 * @param {boolean} [init]			Allow intialization of Mozels and Collections.
	 */
	$set(property:string, value:any, init?:boolean) {
		this.initProperty(property);
		return super.$set(property, value, init);
	}

	$setData(data: Data) {
		forEach(data, (value,key) => {
			this[key] = value; // will trigger the Proxy setter
		});
	}

	exportGeneric() {
		return mapValues(this.genericProperties, (property:Property) => {
			return property.value;
		});
	}

	/**
	 * Initialize a property if it was not already initialized.
	 * @param {string} name		The name of the property.
	 * @return {boolean}	True if the property is initialized (or already was), false if it could not.
	 */
	initProperty(name:string) {
		if(!(name in this)) {
			// Also keep a local copy so we know which ones were created generically
			this.genericProperties[name] = this.$defineProperty(name);
			return true;
		} else if (this.$has(name)) {
			return true;
		}

		return false;
	}
}
