import Model, {Data, isData} from './Model';
import Property, {isComplexValue, isModelClass, ModelClass} from './Property';

import {Class, primitive} from 'validation-kit';
import {forEach, isPlainObject, isString, map, isMatch} from 'lodash';

import Templater from "./Templater";
import EventInterface, {Event} from "event-interface-mixin";

export type CollectionType = ModelClass|Class;
export type CollectionOptions = {reference?:boolean};

export class AddedEvent<T> extends Event<{item:T}>{}
export class RemovedEvent<T> extends Event<{item:T, index:number}>{}

export default class Collection<T extends Model|primitive> {
	static get type() { return 'Collection' };

	private readonly type?:CollectionType;
	private list:T[];
	private readonly removed:T[];

	parent:Model;
	relation:string;
	isReference:boolean = false;

	readonly eventInterface = new EventInterface();

	constructor(parent:Model, relation:string, type?:CollectionType, list = []) {
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

	checkType(value:any):value is T {
		return Property.checkType(value, this.type);
	}

	setParent(parent:Model){
		this.parent = parent;
	}

	/**
	 * Checks if the given item is a valid item for the Collection.
	 * @param item							The item to check for the list.
	 * @param {boolean} [init]	If set to `true`, Model Collections may try to initialize a Model based on the provided data.
	 * @return 		Either the revised item, or `false`, if the item did not pass.
	 */
	revise(item:any, init = false):T|false {
		if(this.checkType(item)) {
			return item;
		}

		// Try to initialize
		if(init && isPlainObject(item) && isModelClass(this.type)) {
			// If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
			return <T><any>this.parent.create(this.type, item, false, this.isReference);
		}
		return false;
	}

	resolveReferences() {
		if(!isModelClass(this.type)) {
			return; // nothing to resolve
		}
		if(!this.isReference) {
			// Have all Models resolve their references
			this.each((item:T) => {
				// The Collection type is a Model class, so our items are Models
				(<Model>item).resolveReferences();
			});
			return;
		}

		// Resolve all references in the list
		for(let i = this.list.length-1; i >= 0; i--) {
			let item = this.list[i];

			if(item instanceof Model) {
				let resolved = this.parent.resolveReference(item);

				if(!resolved) {
					console.error(`No Model found with GID ${item.gid}.`);
				} else if (!this.checkType(resolved)) {
					console.error(`Model with GID ${item.gid} was not a ${this.type}.`);
					resolved = undefined;
				}

				if(!resolved) {
					// Reference was not resolved: remove it from the list
					this.list.splice(i,1);
					continue;
				}

				// Replace placeholder Model with resolved reference
				this.list[i] = resolved;
			}
		}
	}

	/**
	 * Add an item to the Collection.
	 * @param item							The item to add.
	 * @param {boolean} init		If set to `true`, Model Collections may create and initialize a Model based on the given data.
	 */
	add(item:T|object, init = false) {
		let final = this.revise(item, init);
		if(!final) {
			console.error(`Item is not (convertable to) ${this.getTypeName()}`, item);
			return this;
		}
		if(isComplexValue(final)) {
			final.setParent(this.parent, this.relation);
		}
		this.list.push(<T>final);
		this.eventInterface.fire<AddedEvent<T>>(AddedEvent.name, {item: final});
		return this;
	}

	/**
	 * Add an item to the Collection.
	 * @param items							The items to add.
	 * @param {boolean} init		If set to `true`, Model Collections may create and initialize Models based on the given data.
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
		this.list.splice(index, 1);
		if(track) {
			this.removed.push(item);
		}
		this.eventInterface.fire<RemovedEvent<T>>(RemovedEvent.name, {item: item, index: index});
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
		// Check model identity
		if(listItem instanceof Model && isData(specs)) {
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

	toArray() {
		return this.list.slice();
	}

	getRemovedItems() {
		return this.removed;
	}

	export():(Data|primitive)[] {
	  return map(this.list, (item:T) => {
	  	if(item instanceof Model) {
				return item.export();
			}
	  	return item;
		});
	}

	/**
   * @param index
   * @return {Model}
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
			// Render Models recursively
			if(item instanceof Model) {
				item.renderTemplates(templater);
				return;
			}
		}
	}

	onAdded(callback:(controller:T)=>void) {
		this.eventInterface.on<AddedEvent<T>>(AddedEvent.name, (data:{item:T}) => {
			callback(data.item);
		});
	}

	onRemoved(callback:(controller:T, index:number)=>void) {
		this.eventInterface.on<RemovedEvent<T>>(RemovedEvent.name, (data:{item:T, index:number}) => {
			callback(data.item, data.index);
		});
	}
}
