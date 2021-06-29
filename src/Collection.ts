import Mozel, {Data, isData, MozelData} from './Mozel';
import Property, {isMozelClass, MozelClass, PropertyValue} from './Property';

import {Class, primitive} from 'validation-kit';
import {forEach, isFunction, isMatch, isPlainObject, isString, map, remove, concat} from 'lodash';

import Templater from "./Templater";
import Log from 'log-control';

const log = Log.instance("mozel/collection");

export type CollectionType = MozelClass|Class;
export type CollectionOptions = {reference?:boolean};

export type AddedListener<T> = (item:T, index:number)=>void;
export type RemovedListener<T> = (item:T, index:number)=>void;
type CollectionItem = Mozel|primitive;
type FindFunction<T> = (item:T, index:number)=>boolean;

export default class Collection<T extends Mozel|primitive> {
	static get type() { return 'Collection' };

	private readonly type?:CollectionType;
	private list:T[];
	private readonly removed:T[];

	/**
	 * Type errors of items in the collection.
	 */
	private _errors:Record<string, Error> = {};

	parent:Mozel;
	relation:string;
	isReference:boolean = false;

	beforeAddedListeners:AddedListener<CollectionItem>[] = [];
	beforeRemovedListeners:RemovedListener<CollectionItem>[] = [];
	addedListeners:AddedListener<CollectionItem>[] = [];
	removedListeners:RemovedListener<CollectionItem>[] = [];

	constructor(parent:Mozel, relation:string, type?:CollectionType, list:T[] = []) {
		this.type = type;
		this.parent = parent;
		this.relation = relation;

		this.list = [];
		this.setData(list);

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
			return <T><any>this.parent.$create(this.type, item, this.isReference);
		}
		return false;
	}

	add(item:T, notify = true) {
		const index = this.list.length;
		if(notify) this.notifyBeforeAdd(item, index);

		if(item instanceof Mozel) {
			item.$setParent(this.parent, this.relation);
		}
		this.list.push(<T>item);

		if(notify) this.notifyAdded(item, index);
	}

	/**
	 * Removes the item at the given index from the list. Returns the item.
	 * @param {number} index			The index to remove.
	 * @param {boolean} [track]			If set to `true`, item will be kept in `removed` list.
	 */
	removeIndex(index:number, track= false) {
		let item = this.list[index];

		this.notifyBeforeRemove(item, index);

		this.list.splice(index, 1);
		delete this._errors[index];
		if(track) {
			this.removed.push(item);
		}

		this.notifyRemoved(item, index);
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

	/**
	 * Clear all items from the list.
	 */
	clear() {
		const items = this.list.slice();

		// Notify before change
		items.forEach((item, index) => {
			this.notifyBeforeRemove(item, index);
		});

		// Clear the list
		this.list = [];
		this._errors = {};

		// Notify after change
		items.forEach((item, index) => {
			this.notifyRemoved(item, index);
		});
		return this;
	}

	find(specs:Data|T|FindFunction<T>) {
		if(isFunction(specs)) return this.list.find(specs);

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

	toArray() {
		return this.list.slice();
	}

	getRemovedItems() {
		return this.removed;
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

	notifyBeforeRemove(item:T, index:number) {
		this.beforeRemovedListeners.forEach(listener => listener(item, index));
	}

	notifyRemoved(item:T, index:number) {
		this.removedListeners.forEach(listener => listener(item, index));
	}

	notifyBeforeAdd(item:T, index:number) {
		this.beforeAddedListeners.forEach(listener => listener(item, index));
	}

	notifyAdded(item:T, index:number) {
		this.addedListeners.forEach(listener => listener(item, index));
	}

	beforeAdd(callback:AddedListener<CollectionItem>) {
		this.beforeAddedListeners.push(callback);
	}
	onAdded(callback:AddedListener<CollectionItem>) {
		this.addedListeners.push(callback);
	}
	removeAddedListener(callback:AddedListener<CollectionItem>) {
		remove(this.addedListeners, item => item === callback);
	}
	removeBeforeAddedListener(callback:AddedListener<CollectionItem>) {
		remove(this.beforeAddedListeners, item => item === callback);
	}

	beforeRemoved(callback:RemovedListener<CollectionItem>) {
		this.beforeRemovedListeners.push(callback);
	}
	onRemoved(callback:RemovedListener<CollectionItem>) {
		this.removedListeners.push(callback);
	}
	removeRemovedListener(callback:RemovedListener<CollectionItem>) {
		remove(this.removedListeners, item => item === callback);
	}
	removeBeforeRemovedListener(callback:RemovedListener<CollectionItem>) {
		remove(this.beforeRemovedListeners, item => item === callback);
	}

	// COMPLEX VALUE METHODS

	setData(items:Array<object|T>, init = false) {
		const remove:Array<{item: T, index:number}> = [];
		const add:Array<T> = [];

		const resolved:T[] = [];
		items.forEach(item => {
			// Initialize item
			const revisedItem = this.revise(item, init);
			if(!revisedItem) {
				const message = `Item is not (convertable to) ${this.getTypeName()}`;
				log.error(message, item);
				if(this.parent.$strict) {
					return; // we don't add
				}
				// TS: for non-strict models, we disable allow non-typesafe values
				this._errors[this.list.length] = new Error(message);
			}
			// Check for existing item
			if(isMozelClass(this.type)) {
				const existing = this.list.find(existing => (<Mozel>existing).gid === (<Mozel>revisedItem).gid);
				if (existing && existing !== item) {
					(existing as Mozel).$setData(item as MozelData<any>, init);
					resolved.push(existing);
				} else {
					resolved.push(<T>revisedItem);
				}
			}
		});

		// Remove old items not in new list
		this.list.forEach((oldItem, index) => {
			if(!resolved.find(newItem => newItem === oldItem)) {
				remove.push({item: oldItem, index});
			}
		});

		const length = this.list.length - remove.length + add.length;

		// Add new items not in old list
		resolved.forEach(newItem => {
			if(!this.list.find(oldItem => oldItem === newItem)) {
				add.push(newItem);
			}
		});

		// Notify the listeners which items will be removed
		remove.forEach(removal => this.notifyBeforeRemove(removal.item, removal.index));

		// Start with a new list
		this.list = [];
		this._errors = {};

		// Notify listeners which items have been removed
		remove.forEach(removal => this.notifyRemoved(removal.item, removal.index));

		// Notify listeners which items will be added
		add.forEach((item, index) => this.notifyBeforeAdd(item, length + index));

		// Add all items
		resolved.forEach(item => this.add(item, false));

		// Notify listeners which items have been added
		add.forEach((item, index) => this.notifyAdded(item, length + index));

		return this;
	}

	setParent(parent:Mozel){
		this.parent = parent;
	}

	isDefault() {
		// Very simple check, as we don't have a default option for Collections yet
		return this.length === 0;
	}

	resolveReferences() {
		if(!isMozelClass(this.type)) {
			return; // nothing to resolve
		}
		if(!this.isReference) {
			// Have all Mozels resolve their references
			this.each((item:T) => {
				// The Collection type is a Mozel class, so our items are Mozels
				(<Mozel>item).$resolveReferences();
			});
			return;
		}

		// Resolve all references in the list
		for(let i = this.list.length-1; i >= 0; i--) {
			let item = this.list[i];

			if(item instanceof Mozel) {
				let resolved = this.parent.$resolveReference(item);

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

	equals(other:Collection<any>) {
		if(this.type !== other.type) return false;
		if(this.length !== other.length) return false;
		return !this.find((item, index) => {
			return other.get(index) !== item;
		});
	}

	clone() {
		return new Collection<T>(this.parent, this.relation, this.type, this.list.slice());
	}

	cloneDeep() {
		let list = this.toArray();
		if(isMozelClass(this.type)) {
			// TS: We can cast item to Mozel because we checked `isMozelClass`
			// We can cast it to T because Mozel is part of T
			list = this.map(item => <T>(<Mozel>item).$cloneDeep());
		} else {
			list = list.slice();
		}

		return new Collection<T>(this.parent, this.relation, this.type, list);
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
				item.$renderTemplates(templater);
				return;
			}
		}
	}

	path(path:string|string[]):PropertyValue {
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
		if(!(item instanceof Mozel)) {
			// Cannot continue path on primitive value
			return undefined;
		}
		return item.$path(path.slice(1));
	}

	export():(Data|primitive)[] {
		return map(this.list, (item:T) => {
			if(item instanceof Mozel) {
				return item.$export();
			}
			return item;
		});
	}

	pathPattern(path:string|string[], startingPath:string[] = []) {
		if(isString(path)) {
			path = path.split('.');
		}
		if(path.length === 0) {
			return {};
		}

		// Select the items of which to get the rest of the path of
		const step = path[0];
		let items;
		if(step === '*') {
			items = this.list.map((item, index) => ({item, index}));
		} else {
			const index = parseInt(step);
			if(isNaN(index)) return {}; // we don't have non-number indices
			items = [{item: this.list[index], index}];
		}

		let values = {};
		items.forEach(({item, index}) => {
			const indexPath = concat(startingPath, index.toString()).join('.');
			if(item instanceof Mozel) {
				values = {
					...values,
					...item.$pathPattern(path.slice(1), [...startingPath, index.toString()])
				}
			} else if (path.length === 1) {
				values = { ...values, [indexPath]: item };
			} else {
				values = { ...values, [indexPath]: undefined };
			}
		});
		return values;
	}

	get errors() {
		return {...this._errors};
	}
	get $errors() {
		return this.errors;
	}

	errorsDeep() {
		const errors = this.errors;
		this.list.forEach((item, index) => {
			if(item instanceof Mozel) {
				const subErrors = item.$errorsDeep();
				forEach(subErrors, (error, path) => {
					errors[`${index}.${path}`] = error;
				});
			}
		});
		return errors;
	}
}
