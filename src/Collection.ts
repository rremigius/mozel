import {InitArgument, PropertyInput, PropertyOptions, PropertyType, PropertyValue} from "./Property";
import Mozel, {Data, MozelEvents, PropertyData, property, ExportOptions} from "./Mozel";
import {alphanumeric} from "validation-kit";
import {isArray, isNumber, merge} from "lodash";

export type CollectionOptions<T> = {collection?: PropertyOptions<T>, items?: PropertyOptions<T>};

export class CollectionItemEvent<T> {
	constructor(public item:T, public index:number) {	}
}

export class CollectionItemAddedEvent<T> extends CollectionItemEvent<T> {}
export class CollectionItemRemovedEvent<T> extends CollectionItemEvent<T> {}

export class CollectionEvents extends MozelEvents {
	added = this.$event(CollectionItemAddedEvent);
	removed = this.$event(CollectionItemRemovedEvent);
}

/**
 * COLLECTION decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param options
 * @param options.collection			Options for the Collection
 * @param options.items					Options applied to all Collection items
 */
export function collection<T extends PropertyType>(runtimeType?: T, options?:CollectionOptions<T>) {
	return property(Collection as any, Collection.createOptions(runtimeType, options));
}

export default class Collection<T extends PropertyType> extends Mozel {
	MozelDataType:PropertyData<T>[] = [];

	static validateInitData(data:unknown) {
		return isArray(data);
	}

	static createOptions(itemRuntimeType:PropertyType, options?:CollectionOptions<any>) {
		const init = (value:Collection<any>) => {
			options = options || {};
			value.$setItemType(itemRuntimeType);
			value.$setItemPropertyOptions(options.items || {});

			// Also call provided init, since it is about to be overridden
			if(options.collection && options.collection.init) {
				options.collection.init(value as InitArgument<any>);
			}
		};
		options = options || {};
		return {...options.collection, init};
	}

	protected _count = 0;
	protected _itemType:PropertyType = undefined;
	protected _itemPropertyOptions:PropertyOptions<T> = {};

	$events = new CollectionEvents();

	$setItemType(type:PropertyType) {
		this._itemType = type;
	}

	$setData(data: PropertyInput[], merge: boolean = false) {
		if(isArray(data)) {
			const trackID = this.$startTrackingChanges();
			for(let i = 0; i < data.length; i ++) {
				this.$set(i, data[i], true, merge);
			}
			if(!merge) {
				// Remove indexes that don't exist in the new data
				for(let i = this._count-1; i >= data.length; i--) {
					this.$removeIndex(i);
				}
			}
			this.$finishTrackingChanges(trackID);
			return;
		}
		return super.$setData(data, merge);
	}

	$add(item:PropertyData<T>) {
		const trackID = this.$startTrackingChanges();
		const index = this._count;

		let  nextProperty = this.$property(index);
		if(!nextProperty) {
			nextProperty = this.$defineProperty(index + "", this._itemType, this._itemPropertyOptions as PropertyOptions<unknown>);
		}

		// Try to set the value
		if(!nextProperty.set(item, true)) {
			throw new Error(`Trying to add invalid item to Collection: (${typeof item}).`)
		}
		const finalItem = nextProperty.value;

		// Events
		this.$events.added.fire(new CollectionItemAddedEvent(finalItem, index));
		this._count++;

		this.$finishTrackingChanges(trackID);
		return finalItem;
	}

	$property(property?: alphanumeric) {
		if(property === undefined) {
			return super.$property();
		}
		return super.$property(property + "");
	}

	/**
	 * Set property options that will be set on each of the properties containing the Collection's items.
	 * @param options
	 */
	$setItemPropertyOptions(options:PropertyOptions<T>) {
		this._itemPropertyOptions = options;
	}

	$set(index: alphanumeric, value: PropertyInput, init = true, merge = false) {
		if(isNumber(index)) {
			if(index > this._count) {
				throw new Error(`Cannot set index ${index} (out of bounds).`);
			}
			if(index === this._count) {
				return this.$add(value as PropertyData<T>); // will be validated
			}

			const before = this.$get(index);

			if(!super.$set(index + "", value, init, merge)) {
				return false;
			}

			const after = this.$get(index);
			if(before === after) {
				return;
			}
			this.$events.added.fire(new CollectionItemAddedEvent(after, index));
			this.$events.removed.fire(new CollectionItemRemovedEvent(before, index));
			return;
		}

		return super.$set(index + "", value, init, merge);
	}

	$get(index:alphanumeric, resolveReference:boolean = true):PropertyValue {
		if(isNumber(index) && index >= this._count) {
			return undefined;
		}
		return super.$get(index + "", resolveReference);
	}

	$at(index:number, resolveReferences:boolean = true):T {
		return this.$get(index, resolveReferences) as T;
	}

	$remove(child:PropertyValue) {
		const trackID = this.$startTrackingChanges();
		for(let i = 0; i < this._count; i++) {
			const value = this.$get(i);
			if(value == child) {
				this.$removeIndex(i);
			}
		}
		this.$finishTrackingChanges(trackID);
	}

	$removeIndex(indexToRemove:number) {
		if(indexToRemove >= this._count) return;

		const trackID = this.$startTrackingChanges();

		const itemToRemove = this.$get(indexToRemove);

		// Shift all follow values over the one to remove
		for(let i = indexToRemove; i < this._count; i++) {
			const property = this.$property(i);
			const nextProperty = this.$property(i + 1);
			if(!property) {
				throw new Error(`Undefined property at index ${i} in range of Collection count.`);
			}
			if(!nextProperty) {
				this.$undefineProperty(i);
				continue;
			}
			const nextValue = nextProperty.value;

			// Move value from next property to this one
			property.set(nextValue);
		}

		this.$events.removed.fire(new CollectionItemRemovedEvent(itemToRemove, indexToRemove));

		this._count--;

		this.$finishTrackingChanges(trackID);
	}

	$clear() {
		const trackID = this.$startTrackingChanges();

		const removed:(PropertyValue)[] = [];
		const count = this._count;

		// Remove all properties within Collection range
		for(let i = 0; i < this._count; i++) {
			const item = this.$get(i);
			removed.push(item);
			super.$undefineProperty(i + "");
		}
		this._count = 0;

		// Events
		for(let i = 0; i < count; i++) {
			this.$events.removed.fire(new CollectionItemRemovedEvent(removed[i], i));
		}

		this.$finishTrackingChanges(trackID);
	}

	$undefineProperty(index:alphanumeric) {
		return super.$undefineProperty(index + "");
	}

	$map<V>(func:(item:T, index:number)=>V):V[] {
		const results = [];
		for(let i = 0; i < this._count; i++) {
			const item = this.$get(i) as T;
			results.push(func(item, i));
		}
		return results;
	}

	$each<V>(func:(item:T, index:number)=>void):void {
		this.$map(func);
	}

	$toArray() {
		return this.$map(item => item);
	}

	$length() {
		return this._count;
	}

	$export(options?: ExportOptions): Data {
		return this.$map(item => {
			if(item instanceof Mozel) {
				return item.$export(options);
			}
			return item;
		});
	}
}