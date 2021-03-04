import Mozel, {Data, isData} from './Mozel';
import Property, {isComplexValue, isMozelClass, MozelClass, PropertyValue} from './Property';

import {Class, isSubClass, primitive} from 'validation-kit';
import {forEach, isPlainObject, isString, map, isMatch} from 'lodash';

import Templater from "./Templater";
import Log from 'log-control';

const log = Log.instance("mozel/collection")

export type CollectionType = MozelClass|Class;
export type CollectionOptions = {reference?:boolean};

type AddedListener<T> = (item:T)=>void;
type RemovedListener<T> = (item:T, index?:number)=>void;

export default class Collection<T extends Mozel|primitive> {
	static get type() { return 'Collection' };

	private readonly type?:CollectionType;
	private list:T[];
	private readonly removed:T[];

	parent:Mozel;
	relation:string;
	isReference:boolean = false;

	beforeAddedListeners:AddedListener<T>[] = [];
	beforeRemovedListeners:RemovedListener<T>[] = [];
	addedListeners:AddedListener<T>[] = [];
	removedListeners:RemovedListener<T>[] = [];

	constructor(parent:Mozel, relation:string, type?:CollectionType, list:T[] = []) {
		this.type = type;
		this.parent = parent;
		this.relation = relation;

		this.list = [];
		this.addItems(list);

		this.removed = [];
	}

	getTypeName() {
		if(!this.type) {
			return 'primitive';
		}
		return this.type.name;
	}

	getType() {
		return this.type;
	}

	checkType(value:any):value is T {
		return Property.checkType(value, this.type);
	}

	setParent(parent:Mozel){
		this.parent = parent;
	}

	/**
	 * Checks if the given item is a valid item for the Collection.
	 * @param item							The item to check for the list.
	 * @param {boolean} [init]	If set to `true`, Mozel Collections may try to initialize a Mozel based on the provided data.
	 * @return 		Either the revised item, or `false`, if the item did not pass.
	 */
	revise(item:any, init = false):T|false {
		if(this.checkType(item)) {
			return item;
		}

		// Try to initialize
		if(init && isPlainObject(item) && isMozelClass(this.type)) {
			// If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
			return <T><any>this.parent.create(this.type, item, false, this.isReference);
		}
		return false;
	}

	resolveReferences() {
		if(!isMozelClass(this.type)) {
			return; // nothing to resolve
		}
		if(!this.isReference) {
			// Have all Mozels resolve their references
			this.each((item:T) => {
				// The Collection type is a Mozel class, so our items are Mozels
				(<Mozel>item).resolveReferences();
			});
			return;
		}

		// Resolve all references in the list
		for(let i = this.list.length-1; i >= 0; i--) {
			let item = this.list[i];

			if(item instanceof Mozel) {
				let resolved = this.parent.resolveReference(item);

				if(!resolved) {
					log.error(`No Mozel found with GID ${item.gid}.`);
				} else if (!this.checkType(resolved)) {
					log.error(`Mozel with GID ${item.gid} was not a ${this.type}.`);
					resolved = undefined;
				}

				if(!resolved) {
					// Reference was not resolved: remove it from the list
					this.list.splice(i,1);
					continue;
				}

				// Replace placeholder Mozel with resolved reference
				this.list[i] = resolved;
			}
		}
	}

	/**
	 * Add an item to the Collection.
	 * @param item							The item to add.
	 * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize a Mozel based on the given data.
	 */
	add(item:T|object, init = false) {
		let final = this.revise(item, init);
		if(!final) {
			log.error(`Item is not (convertable to) ${this.getTypeName()}`, item);
			return this;
		}
		this.beforeAddedListeners.forEach(listener => listener(<T>final));

		if(isComplexValue(final)) {
			final.setParent(this.parent, this.relation);
		}
		this.list.push(<T>final);

		this.addedListeners.forEach(listener => listener(<T>final));
		return this;
	}

	/**
	 * Add an item to the Collection.
	 * @param items							The items to add.
	 * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize Mozels based on the given data.
	 */
	addItems(items:Array<object|T>, init = false) {
		forEach(items, (item:object|T) => {
			this.add(item, init);
		});
		return this;
	}

	/**
	 * Removes the item at the given index from the list. Returns the item.
	 * @param {number} index			The index to remove.
	 * @param {boolean} [track]		If set to false, the item will not be kept in the `removed` list.
	 */
	removeIndex(index:number, track=true) {
		let item = this.list[index];

		this.beforeRemovedListeners.forEach(listener => listener(item, index));

		this.list.splice(index, 1);
		if(track) {
			this.removed.push(item);
		}

		this.removedListeners.forEach(listener => listener(item, index));
		return item;
	}

	/**
   *
   * @param item
   * @param track      If true, the item will be stored in the 'removed' list and can still be retrieved with getRemovedItems().
   * @return {Collection}
   */
	remove(item:T|Data, track = true) {
		for(let i = this.list.length-1; i >= 0; i--) {
			let listItem = this.list[i];
			if(this.matches(item, listItem)) {
				this.removeIndex(i, track);
			}
		}
		return this;
	}

	/**
	 * Checks whether item is considered equal to listItem.
	 * @param specs			Specs to check for equality.
	 * @param listItem	Item from the list.
	 */
	matches(specs:T|Data, listItem:T) {
		// Check by pointer or value
		if(listItem === specs) {
			return true;
		}
		// Check mozel identity
		if(listItem instanceof Mozel && isData(specs)) {
			// I don't know why TS won't resolve item to Data
			return isMatch(listItem, specs);
		}
		return false;
	}

	get length() {
		return this.list.length;
	}

	clear() {
		this.list = [];
		return this;
	}

	find(specs:Data|T) {
		for(let i in this.list) {
			if(this.matches(specs, this.list[i])) {
				return this.list[i];
			}
		}
	}

	each(func:(item:T, index:number)=>any) {
		return forEach(this.list, (item, index) => func(item, index));
	}

	map<V>(func:(item:T, index:number)=>V):V[] {
		return map(this.list, func);
	}

	indexOf(item:T) {
		return this.list.indexOf(item);
	}

	getPath(path:string|string[]):PropertyValue {
		if(isString(path)) {
			path = path.split('.');
		}
		const step = path[0];
		const index = parseInt(step);

		if(isNaN(index)) return undefined; // not a numeric index
		const item = this.get(index);
		if(path.length === 1) {
			// Last step, so we can return
			return item;
		}
		// More steps to go
		if(!isComplexValue(item)) {
			// Cannot continue path on primitive value
			return undefined;
		}
		return item.getPath(path.slice(1));
	}

	toArray() {
		return this.list.slice();
	}

	getRemovedItems() {
		return this.removed;
	}

	export():(Data|primitive)[] {
	  return map(this.list, (item:T) => {
	  	if(item instanceof Mozel) {
				return item.export();
			}
	  	return item;
		});
	}

	/**
   * @param index
   * @return {Mozel}
   */
	get(index:number):T|undefined {
		return this.list[index];
	}
	set(index:number, item:T) {
		this.list[index] = item;
	}

	isDefault() {
		// Very simple check, as we don't have a default option for Collections yet
		return this.length === 0;
	}

	renderTemplates(templater:Templater|Data) {
		if(!(templater instanceof Templater)) {
			templater = new Templater(templater);
		}
		for(let i in this.list) {
			let item = this.list[i];
			// Render string templates
			if(isString(item)) {
				this.list[i] = templater.render(item);
				return;
			}
			// Render Mozels recursively
			if(item instanceof Mozel) {
				item.renderTemplates(templater);
				return;
			}
		}
	}

	beforeAdd(callback:AddedListener<T>) {
		this.beforeAddedListeners.push(callback);
	}
	onAdded(callback:AddedListener<T>) {
		this.addedListeners.push(callback);
	}

	beforeRemoveod(callback:RemovedListener<T>) {
		this.beforeRemovedListeners.push(callback);
	}
	onRemoved(callback:RemovedListener<T>) {
		this.removedListeners.push(callback);
	}

	cloneDeep() {
		let list = this.toArray();
		if(isMozelClass(this.type)) {
			// TS: We can cast item to Mozel because we checked `isMozelClass`
			// We can cast it to T because Mozel is part of T
			list = this.map(item => <T>(<Mozel>item).cloneDeep());
		} else {
			list = list.slice();
		}

		return new Collection<T>(this.parent, this.relation, this.type, list);
	}
}
