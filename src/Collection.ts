import {PropertyType, PropertyValue} from "./Property";
import Mozel, {MozelData, MozelEvents} from "./Mozel";
import {CollectionItemEvent, CollectionMutations} from "./Collection";
import {alphanumeric} from "validation-kit";
import {isNumber, map} from "lodash";

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
		const property = this.$defineProperty(this._count + "", this._itemType, options);
		property.set(item, true);
	}

	$get(index:alphanumeric, resolveReference:boolean = false):T|undefined {
		return super.$get(index + "", resolveReference) as T|undefined;
	}

	$removeIndex(index:number) {
		this.$undefineProperty(index + "");
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