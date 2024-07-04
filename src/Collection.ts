import {PropertyInput, PropertyType, PropertyValue} from "./Property";
import Mozel, {Data, MozelData, MozelEvents, number} from "./Mozel";
import {alphanumeric} from "validation-kit";
import {isArray, isNumber, merge} from "lodash";

export class CollectionItemEvent<T> {
	constructor(public item:T, public index:number) {	}
}

export class CollectionItemAddedEvent<T> extends CollectionItemEvent<T> {}
export class CollectionItemRemovedEvent<T> extends CollectionItemEvent<T> {}

export class CollectionEvents extends MozelEvents {
	added = this.$event(CollectionItemAddedEvent);
	removed = this.$event(CollectionItemRemovedEvent);
}

type CollectionItemDataType<T> = T extends Mozel ? MozelData<T> : T;

export default class Collection<T extends PropertyValue> extends Mozel {
	MozelDataType:CollectionItemDataType<T>[] = [];

	protected _count = 0;
	protected _itemType:PropertyType = undefined;

	$events = new CollectionEvents();

	$setType(type:PropertyType) {
		this._itemType = type;
	}

	$setData(data: MozelData<Collection<T>>, merge: boolean = false) {
		if(isArray(data)) {
			for(let i = 0; i < data.length; i ++) {
				this.$set(i, data[i]);
			}
			return;
		}
		return super.$setData(data, merge);
	}

	$add(item:T extends Mozel ? MozelData<T> : T) {
		const ownProperty = this.$property();
		const options = ownProperty ? ownProperty.getOptions() : {};
		const index = this._count;

		let  nextProperty = this.$property(index);
		if(!nextProperty) {
			nextProperty = this.$defineProperty(index + "", this._itemType, options);
		}

		// Try to set the value
		if(!nextProperty.set(item, true)) {
			return;
		}

		// Events
		const finalItem = this.$get(index);
		this.$events.added.fire(new CollectionItemAddedEvent(finalItem, index));
		this._count++;
		return finalItem;
	}

	$property(property?: alphanumeric) {
		return super.$property(property + "");
	}

	$set(index: alphanumeric, value: CollectionItemDataType<T>, init = true, merge = false) {
		if(isNumber(index)) {
			if(index > this._count) {
				throw new Error(`Cannot set index ${index} (out of bounds).`);
			}
			if(index === this._count) {
				return this.$add(value);
			}
			// TODO: added/removed events
		}

		return super.$set(index + "", value, init, merge);
	}

	$get(index:alphanumeric, resolveReference:boolean = false):T|undefined {
		if(isNumber(index) && index >= this._count) {
			return undefined;
		}
		return super.$get(index + "", resolveReference) as T|undefined;
	}

	$remove(child:PropertyValue, includeReferences = false) {
		for(let i = 0; i < this._count; i++) {
			const value = this.$get(i);
			if(value == child) {
				this.$removeIndex(i);
			}
		}
	}

	$removeIndex(indexToRemove:number) {
		if(indexToRemove >= this._count) return;

		const itemToRemove = this.$get(indexToRemove);

		// Shift all follow values over the one to remove
		for(let i = indexToRemove; i < this._count; i++) {
			const property = this.$property(i);
			const nextProperty = this.$property(i + 1);
			if(!property) {
				throw new Error(`Undefined property at index ${i} in range of Collection count.`);
			}
			if(!nextProperty) {
				throw new Error(`Undefined property at index ${i+1} in range of Collection count.`);
			}
			const nextValue = nextProperty.value;

			// Move value from next property to this one
			property.set(nextValue);
		}

		this.$events.removed.fire(new CollectionItemAddedEvent(itemToRemove, indexToRemove));
		this.$events.collectionChanged.fire(new CollectionChangedEvent({
			removed: [{index: indexToRemove, item: itemToRemove}]
		}));

		this._count--;
	}

	$clear() {
		const removed:(T|undefined)[] = [];
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
	}

	$undefineProperty(index:alphanumeric) {
		if(isNumber(index)) {
			// Safeguard to prevent accidental removal of properties within collection range without proper handling
			return this.$removeIndex(index);
		}
		return super.$undefineProperty(index);
	}

	$map<V>(func:(item:T, index:number)=>V):V[] {
		const results = [];
		for(let i = 0; i < this._count; i++) {
			const item = this.$get(i) as T;
			results.push(func(item, i));
		}
		return results;
	}
}