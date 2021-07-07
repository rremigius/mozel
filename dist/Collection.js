import Mozel, { isData } from './Mozel';
import Property, { isMozelClass } from './Property';
import { forEach, isFunction, isMatch, isPlainObject, isString, map, get, concat } from 'lodash';
import Templater from "./Templater";
import Log from 'log-control';
import EventInterface, { Event } from "event-interface-mixin";
const log = Log.instance("mozel/collection");
export class CollectionChangedEvent extends Event {
}
export class CollectionBeforeChangeEvent extends Event {
}
export class CollectionItemAddedEvent extends Event {
}
export class CollectionItemRemovedEvent extends Event {
}
export default class Collection {
    constructor(parent, relation, type, list = []) {
        /**
         * Type errors of items in the collection.
         */
        this._errors = {};
        this.isReference = false;
        this.events = new EventInterface();
        this.on = this.events.getOnMethod();
        this.off = this.events.getOffMethod();
        this.type = type;
        this.parent = parent;
        this.relation = relation;
        this.list = [];
        this.setData(list);
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
    getType() {
        return this.type;
    }
    checkType(value) {
        return Property.checkType(value, this.type);
    }
    /**
     * Checks if the given item is a valid item for the Collection.
     * @param item							The item to check for the list.
     * @param {boolean} [init]	If set to `true`, Mozel Collections may try to initialize a Mozel based on the provided data.
     * @return 		Either the revised item, or `false`, if the item did not pass.
     */
    revise(item, init = true) {
        if (this.checkType(item)) {
            return item;
        }
        // Try to initialize
        if (init && isPlainObject(item) && isMozelClass(this.type)) {
            // If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
            return this.parent.$create(this.type, item, this.isReference);
        }
        throw new Error("Could not revise value.");
    }
    add(item, init = true) {
        const index = this.list.length;
        return this.set(index, item, init);
    }
    addDefault() {
        if (this.type === Number)
            return this.add(0, true);
        if (this.type === Boolean)
            return this.add(false, true);
        if (this.type === String)
            return this.add("", true);
        if (isMozelClass(this.type))
            return this.add({}, true);
        throw new Error("Could not add default value.");
    }
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]			If set to `true`, item will be kept in `removed` list.
     */
    removeIndex(index, track = false) {
        let item = this.list[index];
        // All items from the removed index will change
        for (let i = index; i < this.list.length; i++) {
            this.events.fire(new CollectionBeforeChangeEvent({ item: this.list[index], index }));
        }
        this.list.splice(index, 1);
        delete this._errors[index];
        if (track) {
            this.removed.push(item);
        }
        // All items from the removed index have changed
        for (let i = index; i < this.list.length + 1; i++) {
            this.events.fire(new CollectionChangedEvent({ item: this.list[index], index }));
        }
        this.events.fire(new CollectionItemRemovedEvent({ item, index }));
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
        // Check mozel identity
        if (listItem instanceof Mozel && isData(specs)) {
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
        for (let i = items.length; i >= 0; i--) {
            this.removeIndex(i);
        }
        // Reset errors
        this._errors = {};
        return this;
    }
    find(specs) {
        if (isFunction(specs))
            return this.list.find(specs);
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
    filter(func) {
        return this.list.filter(func);
    }
    indexOf(item) {
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
    get(index) {
        return this.list[index];
    }
    /**
     *
     * @param index
     * @param value
     * @param init
     * @param merge				If set to true, will keep the current mozel value if possible, only changing its data
     * @param notifyAddRemove	If set to false, will not fire add/remove events
     */
    set(index, value, init = true, merge = false, notifyAddRemove = true) {
        const current = this.list[index];
        if (value === current)
            return value;
        // New value replaces current Mozel with same GID, but may change data
        if (current instanceof Mozel && isPlainObject(value)
            && (get(value, 'gid') === current.gid || (merge && !get(value, 'gid')))) {
            current.$setData(value, merge);
            return current;
        }
        // Check and initialize value if necessary
        let revised;
        try {
            revised = this.revise(value, init);
        }
        catch (e) {
            const message = `Item ${index} could not be intialized to a valid value.`;
            log.error(message);
            if (this.parent.$strict) {
                throw new Error(message);
            }
            // For non-strict models, we act as if the given value is ok
            this._errors[index] = new Error(message);
            revised = value;
        }
        // Set new value
        this.events.fire(new CollectionBeforeChangeEvent({ item: revised, index }));
        this.list[index] = revised;
        if (revised instanceof Mozel && !this.isReference) {
            revised.$setParent(this.parent, this.relation);
        }
        this.events.fire(new CollectionChangedEvent({ item: revised, index }));
        if (notifyAddRemove) {
            if (current)
                this.events.fire(new CollectionItemRemovedEvent({ item: current, index }));
            if (revised)
                this.events.fire(new CollectionItemAddedEvent({ item: revised, index }));
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
    setData(items, init = true, merge = false) {
        const before = this.list.slice();
        let skipped = 0;
        items.forEach((item, i) => {
            const index = i - skipped;
            // Try to set the item at the current index
            if (!this.set(index, item, init, merge, false)) {
                // Otherwise, remove the index
                this.removeIndex(index);
                skipped++;
            }
        });
        // Remove end of current list if new list is shorter
        for (let i = this.list.length; i > items.length; i--) {
            const item = this.list[i];
            this.events.fire(new CollectionBeforeChangeEvent({ item, index: i }));
            this.list.splice(i, 1);
            this.events.fire(new CollectionChangedEvent({ item, index: i }));
        }
        // Compare before/after
        const after = this.list;
        const countsBefore = this.getCounts(before);
        const countsAfter = this.getCounts(after);
        for (let i = 0; i < Math.max(before.length, after.length); i++) {
            if (before[i] === after[i])
                continue; // no change
            // Was new value added? Or just moved?
            let countBefore = countsBefore.get(after[i]);
            let countAfter = countsAfter.get(after[i]);
            if (countAfter && (!countBefore || countAfter > countBefore)) {
                this.events.fire(new CollectionItemAddedEvent({ item: after[i], index: i }));
            }
            // Was old value deleted? Or just moved?
            countBefore = countsBefore.get(before[i]);
            countAfter = countsAfter.get(before[i]);
            if (countBefore && (!countAfter || countBefore > countAfter)) {
                this.events.fire(new CollectionItemRemovedEvent({ item: before[i], index: i }));
            }
        }
    }
    getCounts(items) {
        const counts = new Map();
        for (let item of items) {
            if (!counts.has(item))
                counts.set(item, 0);
            counts.set(item, counts.get(item) + 1);
        }
        return counts;
    }
    setParent(parent) {
        this.parent = parent;
    }
    isDefault() {
        // Very simple check, as we don't have a default option for Collections yet
        return this.length === 0;
    }
    resolveReferences() {
        if (!isMozelClass(this.type)) {
            return; // nothing to resolve
        }
        if (!this.isReference) {
            // Have all Mozels resolve their references
            this.each((item) => {
                // The Collection type is a Mozel class, so our items are Mozels
                item.$resolveReferences();
            });
            return;
        }
        // Resolve all references in the list
        for (let i = this.list.length - 1; i >= 0; i--) {
            let item = this.list[i];
            if (item instanceof Mozel) {
                let resolved = this.parent.$resolveReference(item);
                if (!resolved) {
                    log.error(`No Mozel found with GID ${item.gid}.`);
                }
                else if (!this.checkType(resolved)) {
                    log.error(`Mozel with GID ${item.gid} was not a ${this.type}.`);
                    resolved = undefined;
                }
                if (!resolved) {
                    // Reference was not resolved: remove it from the list
                    this.list.splice(i, 1);
                    continue;
                }
                // Replace placeholder Mozel with resolved reference
                this.set(i, resolved);
            }
        }
    }
    equals(other) {
        if (this.type !== other.type)
            return false;
        if (this.length !== other.length)
            return false;
        return !this.find((item, index) => {
            return other.get(index) !== item;
        });
    }
    clone() {
        return new Collection(this.parent, this.relation, this.type, this.list.slice());
    }
    cloneDeep() {
        let list = this.toArray();
        if (isMozelClass(this.type)) {
            // TS: We can cast item to Mozel because we checked `isMozelClass`
            // We can cast it to T because Mozel is part of T
            list = this.map(item => item.$cloneDeep());
        }
        else {
            list = list.slice();
        }
        return new Collection(this.parent, this.relation, this.type, list);
    }
    renderTemplates(templater) {
        if (!(templater instanceof Templater)) {
            templater = new Templater(templater);
        }
        for (let i in this.list) {
            let item = this.list[i];
            // Render string templates
            if (isString(item)) {
                this.set(i, templater.render(item));
                return;
            }
            // Render Mozels recursively
            if (item instanceof Mozel) {
                item.$renderTemplates(templater);
                return;
            }
        }
    }
    path(path) {
        if (isString(path)) {
            path = path.split('.');
        }
        const step = path[0];
        const index = parseInt(step);
        if (isNaN(index))
            return undefined; // not a numeric index
        const item = this.get(index);
        if (path.length === 1) {
            // Last step, so we can return
            return item;
        }
        // More steps to go
        if (!(item instanceof Mozel)) {
            // Cannot continue path on primitive value
            return undefined;
        }
        return item.$path(path.slice(1));
    }
    export() {
        return map(this.list, (item) => {
            if (item instanceof Mozel) {
                return item.$export();
            }
            return item;
        });
    }
    pathPattern(path, startingPath = []) {
        if (isString(path)) {
            path = path.split('.');
        }
        if (path.length === 0) {
            return {};
        }
        // Select the items of which to get the rest of the path of
        const step = path[0];
        let items;
        if (step === '*') {
            items = this.list.map((item, index) => ({ item, index }));
        }
        else {
            const index = parseInt(step);
            if (isNaN(index))
                return {}; // we don't have non-number indices
            items = [{ item: this.list[index], index }];
        }
        let values = {};
        items.forEach(({ item, index }) => {
            const indexPath = concat(startingPath, index.toString()).join('.');
            if (item instanceof Mozel) {
                values = {
                    ...values,
                    ...item.$pathPattern(path.slice(1), [...startingPath, index.toString()])
                };
            }
            else if (path.length === 1) {
                values = { ...values, [indexPath]: item };
            }
            else {
                values = { ...values, [indexPath]: undefined };
            }
        });
        return values;
    }
    get errors() {
        return { ...this._errors };
    }
    get $errors() {
        return this.errors;
    }
    errorsDeep() {
        const errors = this.errors;
        this.list.forEach((item, index) => {
            if (item instanceof Mozel) {
                const subErrors = item.$errorsDeep();
                forEach(subErrors, (error, path) => {
                    errors[`${index}.${path}`] = error;
                });
            }
        });
        return errors;
    }
}
//# sourceMappingURL=Collection.js.map