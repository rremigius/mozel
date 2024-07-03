import {PropertyInput, PropertyType, PropertyValue} from "./Property";
import Mozel, {MozelData, MozelEvents, string} from "./Mozel";
import {alphanumeric} from "validation-kit";
import {isNumber, map, remove} from "lodash";
import PropertyWatcher from "./PropertyWatcher";

export class CollectionChangedEvent<T> { constructor(public mutations:CollectionMutations<T>) { }}
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

	$add(item:T) {
		const ownProperty = this.$property();
		const options = ownProperty ? ownProperty.getOptions() : {};
		this.$defineProperty(this._count + "", this._itemType, options);
		this._count++;
		this.$set(this._count, item, true);
	}

	$property(property?: alphanumeric) {
		return super.$property(property + "");
	}

	$set(index: alphanumeric, value: PropertyInput, init = true, merge = false) {
		return super.$set(index + "", value, init, merge);
	}

	$get(index:alphanumeric, resolveReference:boolean = false):T|undefined {
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

		let i = indexToRemove;
		for(let i = indexToRemove; i < this._count; i++) {
			const property = this.$property(i);
			if(!property) {
				break;
			}
			const nextProperty = this.$property(i+1);
			if(!nextProperty) {
				continue;
			}
			const value = nextProperty.value;
			if(!(value instanceof Mozel)) {
				continue;
			}
			// Move value from next property to this one
			property.set(value);
		}

		// Remove all defined properties above the first empty property (if any)
		for(let j = i; j < this._count; j++) {
			super.$undefineProperty(j + "");
		}
		
		this._count = i;
	}

	$undefineProperty(index:alphanumeric) {
		if(isNumber(index)) {
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