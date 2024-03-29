import Mozel, {Data, DestroyedEvent, ExportOptions, isData} from './Mozel';
import Property, {isMozelClass, MozelClass, PropertyValue, Reference} from './Property';
import EventInterface from "event-interface-mixin";

import {alphanumeric, Class, isAlphanumeric, isPrimitive, primitive} from 'validation-kit';
import {concat, forEach, get, isFunction, isMatch, isPlainObject, isString, map} from 'lodash';

import Templater from "./Templater";
import Log from 'log-control';
import {has, isArray} from "./utils";

const log = Log.instance("mozel/collection");

export type CollectionType = MozelClass|Class;
export type CollectionOptions = {reference?:boolean};
export type CollectionMutations<T> = {
	changed?: {index:number, before:T, after:T}[],
	added?: {index: number, item:T}[],
	removed?: {index: number, item:T}[]
}

type CollectionItem = Mozel|primitive;
type FindFunction<T> = (item:T, index:number)=>boolean;

export class CollectionItemEvent<T> {
	constructor(public item:T, public index:number) {	}
}
export class CollectionChangedEvent<T> { constructor(public mutations:CollectionMutations<T>) { }}
export class CollectionBeforeChangeEvent<T> {}
export class CollectionItemAddedEvent<T> extends CollectionItemEvent<T> {}
export class CollectionItemRemovedEvent<T> extends CollectionItemEvent<T> {}

export class CollectionEvents extends EventInterface {
	changed = this.$event(CollectionChangedEvent);
	added = this.$event(CollectionItemAddedEvent);
	removed = this.$event(CollectionItemRemovedEvent);

	beforeChange = this.$event(CollectionBeforeChangeEvent);
}

export default class Collection<T extends Mozel|primitive> {
	static get type() { return 'Collection' };

	static getCounts<T>(items:T[]) {
		const counts = new Map<T, number>();
		for(let item of items) {
			if(!counts.has(item)) counts.set(item, 0);
			counts.set(item, counts.get(item)! + 1);
		}
		return counts;
	}

	static getMutations<T>(before:T[], after:T[]) {
		const mutations:CollectionMutations<T> = {changed: [], added: [], removed: []};

		const countsBefore = this.getCounts(before);
		const countsAfter = this.getCounts(after);
		for(let i = 0; i < Math.max(before.length, after.length); i++) {
			if(before[i] === after[i]) continue; // no change

			mutations.changed!.push({index:i, before: before[i], after: after[i]});

			// Was new value added? Or just moved?
			let countBefore = countsBefore.get(after[i]);
			let countAfter = countsAfter.get(after[i]);
			if(countAfter && (!countBefore || countAfter > countBefore)) {
				mutations.added!.push({index: i, item: after[i]});
			}

			// Was old value deleted? Or just moved?
			countBefore = countsBefore.get(before[i]);
			countAfter = countsAfter.get(before[i]);
			if(countBefore && (!countAfter || countBefore > countAfter)) {
				mutations.removed!.push({index: i, item: before[i]});
			}
		}
		return mutations;
	}

	private readonly type?:CollectionType;
	private readonly _list:T[];
	private refs:Reference[] = [];

	private _errors:Record<string, Error> = {};
	private _mozelDestroyedListener = (event:DestroyedEvent) => this.remove(event.mozel as T);

	parent:Mozel;
	relation:string;
	isReference:boolean = false;

	events = new CollectionEvents();

	constructor(parent:Mozel, relation:string, type?:CollectionType, list:T[] = []) {
		this.type = type;
		this.parent = parent;
		this.relation = relation;

		this._list = [];
		this.setData(list);
	}

	protected get list() {
		return this.getList()
	}

	protected getList(resolveReferences = true) {
		if(resolveReferences && this.isReference && this.refs.length) {
			this.resolveReferences();
		}
		return this._list;
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

	isPrimitiveType() {
		return !this.isMozelType() && !this.isCollectionType();
	}

	isMozelType() {
		return isMozelClass(this.type);
	}

	isCollectionType() {
		return this.type === Collection;
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
	revise(item:any, init = true):T {
		if(this.checkType(item)) {
			return item;
		}
		if(this.isReference) throw new Error(`Collection of references can only accept Mozels or References.`);

		// Try to initialize
		if(init && isPlainObject(item) && isMozelClass(this.type)) {
			if(item.gid) { // gid is only key in object
				// Maybe it already exists
				const mozel = this.parent.$resolveReference(item);
				if(mozel && this.checkType(mozel)) return mozel;
			}

			// If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
			return <T><any>this.parent.$create(this.type, item);
		}

		// Parse primitives
		if(this.type && this.isPrimitiveType() && isPrimitive(item)) {
			item = Property.tryParseValue(item, this.type);
			if(this.checkType(item)) {
				return item;
			}
		}
		throw new Error("Invalid value for Collection.");
	}

	add(item:object|T, init = true) {
		const index = this.list.length;
		return this.set(index, item, init);
	}

	addDefault() {
		if(this.type === Number) return this.add(0 as T, true);
		if(this.type === Boolean) return this.add(false as T, true)
		if(this.type === String) return this.add("" as T, true);
		if(isMozelClass(this.type)) return this.add({} as T, true);
		throw new Error("Could not add default value.");
	}

	/**
	 * Removes the item at the given index from the list. Returns the item.
	 * @param {number} index			The index to remove.
	 * @param {boolean} [fireEvents]	If set to `false`, will not send modification events
	 */
	removeIndex(index:number, fireEvents = true) {
		let item = this._list[index];

		// All items from the removed index will change
		if(fireEvents) this.events.beforeChange.fire(new CollectionBeforeChangeEvent());

		this._list.splice(index, 1);
		delete this._errors[index];

		if(fireEvents) {
			this.events.changed.fire(new CollectionChangedEvent({
				removed: [{item, index}],
				changed: [{index, before: item, after: this._list[index]}]
			}));
			this.events.removed.fire(new CollectionItemRemovedEvent(item, index));
		}

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
		for(let i = items.length; i >= 0; i--) {
			this.removeIndex(i);
		}
		// Reset errors
		this._errors = {};
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

	filter(func:(item:T, index:number)=>boolean):T[] {
		return this.list.filter(func);
	}

	indexOf(item:T) {
		return this.list.indexOf(item);
	}

	/**
	 *
	 * @param {boolean} resolveReferences	If set to false, will not try to resolve any references.
	 */
	toArray(resolveReferences = true) {
		return this.getList(resolveReferences).slice();
	}

	/**
   	 * @param index
	 * @param {boolean} resolveReferences	If set to false, will not try to resolve references first.
   	 * @return {Mozel}
   	*/
	get(index:number, resolveReferences = true):T|undefined {
		return this.getList(resolveReferences)[index];
	}

	/**
	 *
	 * @param index
	 * @param value
	 * @param init
	 * @param merge			If set to true, will keep the current mozel value if possible, only changing its data
	 * @param fireEvents	If set to false, will not fire modification events
	 */
	set(index:number, value:object|T, init = true, merge = false, fireEvents = true) {
		const current = this._list[index];

		// Handle references
		if(this.isReference && isPlainObject(value) && isAlphanumeric(get(value, 'gid'))) {
			this.refs[index] = value as Reference;
			const resolved = this.parent.$resolveReference(value as Reference);
			if(!resolved) {
				// cannot be resolved yet; wait for lazy resolve
				return true;
			} else {
				value = resolved;
			}
		}
		if(value === current) return value;

		// SetData: new value is object with same gid, and other data
		const gid = get(value, 'gid');
		if(init && !this.isReference && current instanceof Mozel && isPlainObject(value)
			&& (
				(gid === current.gid && Object.keys(value).length !== 1)	// gid is same, but there is more data
				|| (!gid && merge) // gid is missing but we're merging
			)
		) {
			current.$setData(value as Data, merge);
			return current;
		}

		// Check and initialize value if necessary
		let revised:T;
		try {
			revised = this.revise(value, init);
		} catch(e) {
			const message = `Must be a ${this.getTypeName()}.`;
			log.error(message, "Received: ", value);
			if (this.parent.$strict) {
				throw new Error(message);
			}
			// For non-strict models, we act as if the given value is ok
			this._errors[index] = new Error(message);
			revised = value as T;
		}
		if(revised === current) {
			// If new data was provided, set new data
			if(!this.isReference && revised instanceof Mozel && isPlainObject(value) && Object.keys(value).length > 1) {
				revised.$setData(value as any);
			}
			return revised;
		}

		if(current instanceof Mozel) {
			current.$events.destroyed.off(this._mozelDestroyedListener);
		}

		// Set new value
		if(fireEvents) this.events.beforeChange.fire(new CollectionBeforeChangeEvent());
		if(revised instanceof Mozel) {
			revised.$events.destroyed.on(this._mozelDestroyedListener);
			if(!this.isReference) {
				// Must  be done *before* setting it on the list, because `$setParent` might remove it from the
				// Collection if it was already there.
				revised.$setParent(this.parent, this.relation);
			}
		}
		// Index check (only for non-reference Collections)
		if(this.isReference && index > this._list.length) {
			return false;
		}
		this._list[index] = revised;

		if(fireEvents) {
			this.events.changed.fire(new CollectionChangedEvent({
				added: [{index, item: revised}],
				changed: [{index, before: current, after: revised}]
			}));
			if(current) this.events.removed.fire(new CollectionItemRemovedEvent(current, index));
			if(revised) this.events.added.fire(new CollectionItemAddedEvent(revised, index));
		}

		return revised;
	}

	// COMPLEX VALUE METHODS

	/**
	 *
	 * @param items
	 * @param init
	 * @param merge		If set to true, each item mozel will be kept if possible; only changing the data
	 */
	setData(items:Array<object|T>, init = true, merge = false) {
		if(!isArray(items)) return;

		const before = this._list.slice();

		this.events.beforeChange.fire(new CollectionBeforeChangeEvent());

		let skipped = 0;
		for(let i = 0; i < items.length; i++) {
			const item = items[i];
			const index = i - skipped;

			// Try to set the item at the current index
			if(!this.set(index, item, init, merge, false)) {
				// Otherwise, remove the index
				this.removeIndex(index, false);
				skipped++;
			}
		}

		// Remove end of current list if new list is shorter
		for(let i = this._list.length-1; i >= items.length; i--) {
			this._list.splice(i, 1);
		}


		const mutations = Collection.getMutations(before, this._list);
		this.events.changed.fire(new CollectionChangedEvent(mutations));
		if(mutations.added) {
			mutations.added.forEach(added => this.events.added.fire(new CollectionItemAddedEvent(added.item, added.index)));
		}
		if(mutations.removed) {
			mutations.removed.forEach(removed => this.events.removed.fire(new CollectionItemRemovedEvent(removed.item, removed.index)));
		}
	}

	setParent(parent:Mozel){
		this.parent = parent;
	}

	isDefault() {
		// Very simple check, as we don't have a default option for Collections yet
		return this.length === 0;
	}

	resolveReference(index:number, errorOnNotFound = true) {
		const reference = this.refs[index];
		const current = this._list[index];
		if(!reference) return;
		if(current instanceof Mozel && current.gid === reference.gid) return current;

		const resolved = this.parent.$resolveReference(reference);
		if(!resolved && errorOnNotFound) {
			log.error(`Could not resolve reference with GID ${reference.gid}. Either the reference is faulty, or a read was attempted before the referenced object was created.`);
			return;
		}
		this.set(index, resolved as T);
	}

	resolveReferences(recursive = false) {
		if(!isMozelClass(this.type)) {
			return; // nothing to resolve
		}
		if(!this.isReference && recursive) {
			// Have all Mozels resolve their references
			this.each((item:T) => {
				// The Collection type is a Mozel class, so our items are Mozels
				(<Mozel>item).$resolveReferences();
			});
			return;
		}

		if(!this.refs.length) return;

		// Resolve all references in the list
		const items = [];
		for(let i = 0; i < this.refs.length; i++) {
			const ref = this.refs[i];
			if(!ref) continue; // already resolved

			const resolved = this.parent.$resolveReference(ref);
			if(!resolved) {
				log.error(`Could not resolve Mozel with GID '${ref.gid}'`);
				continue;
			}
			if(resolved) items.push(resolved);
		}

		this.refs = []; // reset references
		this.setData(items);
		return;
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

	cloneDeep(parent:Mozel) {
		let list = this.toArray();
		if(isMozelClass(this.type)) {
			// TS: We can cast item to Mozel because we checked `isMozelClass`
			// We can cast it to T because Mozel is part of T
			list = this.map(item => <T>(<Mozel>item).$cloneDeep());
		} else {
			list = list.slice();
		}

		return new Collection<T>(parent, this.relation, this.type, list);
	}

	renderTemplates(templater:Templater|Data) {
		if(!(templater instanceof Templater)) {
			templater = new Templater(templater);
		}
		for(let i in this.list) {
			let item = this.list[i];
			// Render string templates
			if(isString(item)) {
				this.set(i as unknown as number, templater.render(item));
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

	pathPattern(path:string|string[], startingPath:string[] = [], resolveReferences = true) {
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
			items = this.getList(resolveReferences).map((item, index) => ({item, index}));
		} else {
			const index = parseInt(step);
			if(isNaN(index)) return {}; // we don't have non-number indices
			items = [{item: this.getList(resolveReferences)[index], index}];
		}

		let values = {};
		items.forEach(({item, index}) => {
			const indexPath = concat(startingPath, index.toString()).join('.');
			if(item instanceof Mozel) {
				values = {
					...values,
					...item.$pathPattern(path.slice(1), [...startingPath, index.toString()], resolveReferences)
				}
			} else if (path.length === 1) {
				values = { ...values, [indexPath]: item };
			} else {
				values = { ...values, [indexPath]: undefined };
			}
		});
		return values;
	}

	setPath(path:string|string[], value:any, initAlongPath = true) {
		const pathArray = isArray(path) ? path : path.split('.');
		if(pathArray.length === 0) {
			throw new Error("Cannot set 0-length path.");
		}

		const index = parseInt(pathArray[0]);
		if(isNaN(index)) throw new Error(`Index should be a number. Received: ${index}`);

		if(pathArray.length === 1) {
			return this.set(index, value);
		}

		let sub = this.get(index);

		// Initialize if necessary
		if(!(sub instanceof Mozel) && initAlongPath) {
			sub = this.set(index, {}, true) as T;
		}
		const newPath = pathArray.slice(1);
		(sub as Mozel).$setPath(newPath, value);
	}

	/**
	 *
	 * @param options Options to pass to each of the Mozel.$export calls.
	 */
	export(options?:ExportOptions):(Data|primitive)[] {
		return map(this.list, (item:T) => {
			if(item instanceof Mozel) {
				if(options && options.shallow) {
					return item.$export({keys: ['gid']})
				}
				return item.$export(options);
			}
			return item;
		});
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
