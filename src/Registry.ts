import {Class, alphanumeric} from "validation-kit";
import logRoot from "./log";

const log = logRoot.instance("registry");

export type Registerable = {id?:alphanumeric, gid?:alphanumeric};

export default class Registry<T extends Registerable> {
	private indexById:Record<alphanumeric,T> = {};
	private indexByGid:Record<alphanumeric,T> = {};

	register(item:T) {
		if(item.id) {
			if(item.id in this.indexById) {
				log.error(`Duplicate registration for ID: ${item.id}.`);
			} else {
				this.indexById[item.id] = item;
			}
		}
		if(item.gid) {
			if(item.gid in this.indexByGid) {
				log.error(`Duplicate registration for GID: ${item.gid}.`);
			} else {
				this.indexByGid[item.gid] = item;
			}
		}
	}

	remove(item:T) {
		if(item.id) {
			delete this.indexById[item.id];
		}
		if(item.gid) {
			delete this.indexByGid[item.gid];
		}
	}

	find(ids:{id?:alphanumeric, gid?:alphanumeric}) {
		if(ids.id) {
			let item = this.byId(ids.id);
			if(item) return item;
		}
		if(ids.gid) {
			let item = this.byGid(ids.gid);
			if(item) return item;
		}
		return; // not found
	}

	byId<E extends T>(id:alphanumeric, ExpectedClass?:Class):E|undefined {
		const found = this.indexById[id];
		if(ExpectedClass && !(found instanceof ExpectedClass)) {
			log.error(`Object with ID ${id} was found, but was not a ${ExpectedClass.name}.`);
			return undefined;
		}
		return <E>found;
	}
	byGid<E extends T>(gid:alphanumeric, ExpectedClass?:Class):E|undefined {
		const found = this.indexByGid[gid];
		if(ExpectedClass && !(found instanceof ExpectedClass)) {
			log.error(`Object with GID ${gid} was found, but was not a ${ExpectedClass.name}.`);
			return undefined;
		}
		return <E>found;
	}

	/**
	 * Find the current maximum numeric GID in the Registry. String values are ignored.
	 */
	findMaxGid() {
		let max = 0;
		Object.keys(this.indexByGid).forEach((gid:string) => {
			const numeric = parseInt(gid);
			if(numeric.toString() !== gid) return; // gid is not an integer string index
			if(numeric > max) max = numeric;
		});
		return max;
	}
}
