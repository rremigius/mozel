import {Class, alphanumeric} from "validation-kit";
import logRoot from "./log";
import {isNil} from 'lodash';
import {uniqueId, values} from "./utils";
import EventInterface, {EventEmitter} from "event-interface-mixin";

const log = logRoot.instance("registry");

export type Registerable = {id?:alphanumeric, gid?:alphanumeric};

export class RegistryItemAdded<T> { constructor(public item:T) {} }
export class RegistryItemRemoved<T> { constructor(public item:T) {} }
export class RegistryEvents<T> extends EventInterface {
	added = this.$event(RegistryItemAdded) as EventEmitter<RegistryItemAdded<T>>;
	removed = this.$event(RegistryItemRemoved) as EventEmitter<RegistryItemRemoved<T>>;
}

export default class Registry<T extends Registerable> {
	public readonly id = uniqueId('registry-');
	public readonly events = new RegistryEvents();

	private indexByGid:Record<alphanumeric,T> = {};

	register(item:T) {
		if(!isNil(item.gid)) {
			if(item.gid in this.indexByGid) {
				throw new Error(`Duplicate registration for GID: ${item.gid}.`);
			} else {
				this.indexByGid[item.gid] = item;
			}
		}
		this.events.added.fire(new RegistryItemAdded(item));
	}

	remove(item:T) {
		if(!isNil(item.gid)) {
			delete this.indexByGid[item.gid];
		}
		this.events.removed.fire(new RegistryItemRemoved(item));
	}

	find(gid?:alphanumeric) {
		if(!isNil(gid)) {
			let item = this.byGid(gid);
			if(item) return item;
		}
		return; // not found
	}

	byGid<E extends T>(gid:alphanumeric, ExpectedClass?:Class):E|undefined {
		const found = this.indexByGid[gid];
		if(ExpectedClass && !(found instanceof ExpectedClass)) {
			log.error(`Object with GID ${gid} was found, but was not a ${ExpectedClass.name}.`);
			return undefined;
		}
		return <E>found;
	}

	all() {
		return values(this.indexByGid);
	}

}
