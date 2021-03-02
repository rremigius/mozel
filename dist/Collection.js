import Mozel, { isData } from './Mozel';
import Property, { isComplexValue, isModelClass } from './Property';
import { forEach, isPlainObject, isString, map, isMatch } from 'lodash';
import Templater from "./Templater";
import EventInterface, { Event } from "event-interface-mixin";
export class AddedEvent extends Event {
}
export class RemovedEvent extends Event {
}
export default class Collection {
    constructor(parent, relation, type, list = []) {
        this.isReference = false;
        this.eventInterface = new EventInterface();
        this.type = type;
        this.parent = parent;
        this.relation = relation;
        this.list = [];
        this.addItems(list);
        this.removed = [];
    }
    static get type() { return 'Collection'; }
    ;
    getTypeName() {
        if (!this.type) {
            return 'primitive';
        }
        return this.type.name;
    }
    checkType(value) {
        return Property.checkType(value, this.type);
    }
    setParent(parent) {
        this.parent = parent;
    }
    /**
     * Checks if the given item is a valid item for the Collection.
     * @param item							The item to check for the list.
     * @param {boolean} [init]	If set to `true`, Model Collections may try to initialize a Model based on the provided data.
     * @return 		Either the revised item, or `false`, if the item did not pass.
     */
    revise(item, init = false) {
        if (this.checkType(item)) {
            return item;
        }
        // Try to initialize
        if (init && isPlainObject(item) && isModelClass(this.type)) {
            // If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
            return this.parent.create(this.type, item, false, this.isReference);
        }
        return false;
    }
    resolveReferences() {
        if (!isModelClass(this.type)) {
            return; // nothing to resolve
        }
        if (!this.isReference) {
            // Have all Models resolve their references
            this.each((item) => {
                // The Collection type is a Model class, so our items are Models
                item.resolveReferences();
            });
            return;
        }
        // Resolve all references in the list
        for (let i = this.list.length - 1; i >= 0; i--) {
            let item = this.list[i];
            if (item instanceof Mozel) {
                let resolved = this.parent.resolveReference(item);
                if (!resolved) {
                    console.error(`No Model found with GID ${item.gid}.`);
                }
                else if (!this.checkType(resolved)) {
                    console.error(`Model with GID ${item.gid} was not a ${this.type}.`);
                    resolved = undefined;
                }
                if (!resolved) {
                    // Reference was not resolved: remove it from the list
                    this.list.splice(i, 1);
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
    add(item, init = false) {
        let final = this.revise(item, init);
        if (!final) {
            console.error(`Item is not (convertable to) ${this.getTypeName()}`, item);
            return this;
        }
        if (isComplexValue(final)) {
            final.setParent(this.parent, this.relation);
        }
        this.list.push(final);
        this.eventInterface.fire(AddedEvent.name, { item: final });
        return this;
    }
    /**
     * Add an item to the Collection.
     * @param items							The items to add.
     * @param {boolean} init		If set to `true`, Model Collections may create and initialize Models based on the given data.
     */
    addItems(items, init = false) {
        forEach(items, (item) => {
            this.add(item, init);
        });
        return this;
    }
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]		If set to false, the item will not be kept in the `removed` list.
     */
    removeIndex(index, track = true) {
        let item = this.list[index];
        this.list.splice(index, 1);
        if (track) {
            this.removed.push(item);
        }
        this.eventInterface.fire(RemovedEvent.name, { item: item, index: index });
        return item;
    }
    /**
   *
   * @param item
   * @param track      If true, the item will be stored in the 'removed' list and can still be retrieved with getRemovedItems().
   * @return {Collection}
   */
    remove(item, track = true) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            let listItem = this.list[i];
            if (this.matches(item, listItem)) {
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
    matches(specs, listItem) {
        // Check by pointer or value
        if (listItem === specs) {
            return true;
        }
        // Check model identity
        if (listItem instanceof Mozel && isData(specs)) {
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
    find(specs) {
        for (let i in this.list) {
            if (this.matches(specs, this.list[i])) {
                return this.list[i];
            }
        }
    }
    each(func) {
        return forEach(this.list, (item, index) => func(item, index));
    }
    map(func) {
        return map(this.list, func);
    }
    toArray() {
        return this.list.slice();
    }
    getRemovedItems() {
        return this.removed;
    }
    export() {
        return map(this.list, (item) => {
            if (item instanceof Mozel) {
                return item.export();
            }
            return item;
        });
    }
    /**
   * @param index
   * @return {Mozel}
   */
    get(index) {
        return this.list[index];
    }
    set(index, item) {
        this.list[index] = item;
    }
    isDefault() {
        // Very simple check, as we don't have a default option for Collections yet
        return this.length === 0;
    }
    renderTemplates(templater) {
        if (!(templater instanceof Templater)) {
            templater = new Templater(templater);
        }
        for (let i in this.list) {
            let item = this.list[i];
            // Render string templates
            if (isString(item)) {
                this.list[i] = templater.render(item);
                return;
            }
            // Render Models recursively
            if (item instanceof Mozel) {
                item.renderTemplates(templater);
                return;
            }
        }
    }
    onAdded(callback) {
        this.eventInterface.on(AddedEvent.name, (data) => {
            callback(data.item);
        });
    }
    onRemoved(callback) {
        this.eventInterface.on(RemovedEvent.name, (data) => {
            callback(data.item, data.index);
        });
    }
}
//# sourceMappingURL=Collection.js.map