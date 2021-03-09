import Mozel, { isData } from './Mozel';
import Property, { isComplexValue, isMozelClass } from './Property';
import { forEach, isPlainObject, isString, map, isMatch, clone } from 'lodash';
import Templater from "./Templater";
import Log from 'log-control';
const log = Log.instance("mozel/collection");
export default class Collection {
    constructor(parent, relation, type, list = []) {
        /**
         * Type errors of items in the collection.
         */
        this._errors = {};
        this.isReference = false;
        this.beforeAddedListeners = [];
        this.beforeRemovedListeners = [];
        this.addedListeners = [];
        this.removedListeners = [];
        this.$setData = this.setData;
        this.$setParent = this.setParent;
        this.$isDefault = this.isDefault;
        this.$resolveReferences = this.resolveReferences;
        this.$cloneDeep = this.cloneDeep;
        this.$renderTemplates = this.renderTemplates;
        this.$path = this.path;
        this.$export = this.export;
        this.$pathPattern = this.pathPattern;
        this.$errorsDeep = this.errorsDeep;
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
    revise(item, init = false) {
        if (this.checkType(item)) {
            return item;
        }
        // Try to initialize
        if (init && isPlainObject(item) && isMozelClass(this.type)) {
            // If the Collection was set up correctly, this.type should match T and we can assume it's the correct value
            return this.parent.$create(this.type, item, false, this.isReference);
        }
        return false;
    }
    /**
     * Add an item to the Collection.
     * @param item					The item to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize a Mozel based on the given data.
     * @param {BatchInfo} [batch]	Provide batch information for the listeners. Defaults to {index: 0, total:1};
     */
    add(item, init = false, batch) {
        if (!batch)
            batch = { index: 0, total: 1 };
        let final = this.revise(item, init);
        if (!final) {
            const message = `Item is not (convertable to) ${this.getTypeName()}`;
            log.error(message, item);
            if (this.parent.$strict) {
                return this;
            }
            this._errors[this.list.length] = new Error(message);
            // TS: for non-strict models, we disable allow non-typesafe values
            final = item;
        }
        this.notifyBeforeAdd(final, batch);
        if (isComplexValue(final)) {
            final.$setParent(this.parent, this.relation);
        }
        this.list.push(final);
        this.notifyAdded(final, batch);
        return this;
    }
    /**
     * Add an item to the Collection.
     * @param items							The items to add.
     * @param {boolean} init		If set to `true`, Mozel Collections may create and initialize Mozels based on the given data.
     */
    addItems(items, init = false) {
        items.forEach((item, index) => {
            this.add(item, init, { index, total: items.length });
        });
        return this;
    }
    /**
     * Removes the item at the given index from the list. Returns the item.
     * @param {number} index			The index to remove.
     * @param {boolean} [track]			If set to `true`, item will be kept in `removed` list.
     * @param {boolean} [batch]			Provide batch information for change listeners. Defaults to {index: 0, total: 1}.
     */
    removeIndex(index, track = false, batch) {
        if (!batch)
            batch = { index: 0, total: 1 };
        let item = this.list[index];
        this.notifyBeforeRemove(item, index, batch);
        this.list.splice(index, 1);
        delete this._errors[index];
        if (track) {
            this.removed.push(item);
        }
        this.notifyRemoved(item, index, batch);
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
     * @param {BatchInfo} [batch]		If clear operation is part of a larger batch of operations, this sets the batch info.
     */
    clear(batch) {
        const start = batch ? clone(batch) : { index: 0, total: this.list.length };
        const items = this.list.slice();
        // Notify before change
        items.forEach((item, index) => {
            // TS: forEach is synchronous and we don't change batch to undefined.
            this.notifyBeforeRemove(item, index, { index: start.index + index, total: start.total });
        });
        // Clear the list
        this.list = [];
        this._errors = {};
        // Notify after change
        items.forEach((item, index) => {
            this.notifyRemoved(item, index, { index: start.index + index, total: start.total });
        });
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
    set(index, item) {
        this.list[index] = item;
    }
    notifyBeforeRemove(item, index, batch) {
        this.beforeRemovedListeners.forEach(listener => listener(item, index, batch));
    }
    notifyRemoved(item, index, batch) {
        this.removedListeners.forEach(listener => listener(item, index, batch));
    }
    notifyBeforeAdd(item, batch) {
        this.beforeAddedListeners.forEach(listener => listener(item, batch));
    }
    notifyAdded(item, batch) {
        this.addedListeners.forEach(listener => listener(item, batch));
    }
    beforeAdd(callback) {
        this.beforeAddedListeners.push(callback);
    }
    onAdded(callback) {
        this.addedListeners.push(callback);
    }
    beforeRemoved(callback) {
        this.beforeRemovedListeners.push(callback);
    }
    onRemoved(callback) {
        this.removedListeners.push(callback);
    }
    // COMPLEX VALUE METHODS
    setData(items, init = false) {
        const oldCount = this.list.length;
        const batch = { index: 0, total: oldCount + items.length };
        this.clear(batch);
        items.forEach((item, index) => {
            this.add(item, init, { index: oldCount + index, total: batch.total });
        });
        return this;
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
                this.list[i] = resolved;
            }
        }
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
                this.list[i] = templater.render(item);
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
        if (!isComplexValue(item)) {
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
        if (!isMozelClass(this.getType()) || path.length === 0) {
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
            if (item instanceof Mozel) {
                values = {
                    ...values,
                    ...item.$pathPattern(path.slice(1), [...startingPath, index.toString()])
                };
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