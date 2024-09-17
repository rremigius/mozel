import Mozel, { MozelEvents, property } from "./Mozel";
import { isArray, isPlainObject, isString } from "lodash";
export class CollectionItemEvent {
    item;
    index;
    constructor(item, index) {
        this.item = item;
        this.index = index;
    }
}
export class CollectionItemAddedEvent extends CollectionItemEvent {
}
export class CollectionItemRemovedEvent extends CollectionItemEvent {
}
export class CollectionEvents extends MozelEvents {
    added = this.$event(CollectionItemAddedEvent);
    removed = this.$event(CollectionItemRemovedEvent);
}
/**
 * COLLECTION decorator factory
 * Defines a runtime type-safe Property instance for this property and overrides the current property
 * with a getter/setter to access the Property.
 * @param {PropertyType} runtimeType
 * @param itemPropertyOptions								Options applied to the Collection itself
 * @param collectionPropertyOptions
 * @param collectionPropertyOptions.itemPropertyOptions		Options applied to all Collection items
 */
export function collection(runtimeType, itemPropertyOptions, collectionPropertyOptions) {
    collectionPropertyOptions = collectionPropertyOptions || {};
    // Transalte to standard @property decorator
    return property(Collection, {
        ...collectionPropertyOptions,
        typeOptions: {
            ...collectionPropertyOptions.typeOptions,
            itemType: runtimeType,
            itemPropertyOptions: itemPropertyOptions
        }
    });
}
export default class Collection extends Mozel {
    // Either an array of its items, or an object with gid and an array in its '$items' key.
    MozelDataType = {};
    MozelConfigType = {};
    static validateInitData(data) {
        return isPlainObject(data) || isArray(data);
    }
    _count = 0;
    _config = {};
    /** Quick access list */
    _list = [];
    $events = new CollectionEvents();
    isCollectionIndex(key) {
        return parseFloat(key) % 1 === 0;
    }
    $setData(data, merge = false) {
        if (isArray(data)) {
            const trackID = this.$startTrackingChanges();
            for (let i = 0; i < data.length; i++) {
                this.$set(i, data[i], true, merge);
            }
            if (!merge) {
                // Remove indexes that don't exist in the new data
                for (let i = this._count - 1; i >= data.length; i--) {
                    this.$removeIndex(i);
                }
            }
            this.$finishTrackingChanges(trackID);
            return;
        }
        // Object with $items
        if (isPlainObject(data) && isArray(data.$items)) {
            // Let this same function handle the items, then continue to set the regular properties.
            this.$setData(data.$items);
        }
        return super.$setData(data, merge);
    }
    $add(item, init = true) {
        const trackID = this.$startTrackingChanges();
        const index = this._count;
        let nextProperty = this.$property(index); // should create if it doesn't exist
        if (!nextProperty) {
            throw new Error(`Could not create new Property at index ${index}.`);
        }
        // Try to set the value
        if (!nextProperty.set(item, init)) {
            throw new Error(`Trying to add invalid item to Collection: (${typeof item}).`);
        }
        const finalItem = nextProperty.value;
        // Events
        this.$events.added.fire(new CollectionItemAddedEvent(finalItem, index));
        this._count++;
        this.$finishTrackingChanges(trackID);
        return true;
    }
    $property(property) {
        if (property === undefined) {
            return super.$property();
        }
        if (isString(property)) {
            property = parseInt(property);
        }
        // If the requested property is a collection index, allow to create it on the fly
        if (!this.$has(property + "") && this.isCollectionIndex(property)) {
            const newProperty = this.$defineProperty(property + "", this._config.itemType, this._config.itemPropertyOptions);
            // Automatically clean up next tick if automatically created property was not used successfully.
            setTimeout(() => {
                if (this._count <= property) {
                    this.$undefineProperty(newProperty.name);
                }
            });
        }
        return super.$property(property + "");
    }
    $set(index, value, init = true, merge = false) {
        if (this.isCollectionIndex(index)) {
            const parsedIndex = parseInt(index);
            if (parsedIndex > this._count) {
                throw new Error(`Cannot set index ${parsedIndex} (out of bounds).`);
            }
            if (parsedIndex === this._count) {
                return this.$add(value); // will be validated
            }
            const before = this.$get(parsedIndex);
            if (!super.$set(parsedIndex + "", value, init, merge)) {
                return false;
            }
            const after = this.$get(parsedIndex);
            if (before === after) {
                return true;
            }
            this.$events.added.fire(new CollectionItemAddedEvent(after, parsedIndex));
            this.$events.removed.fire(new CollectionItemRemovedEvent(before, parsedIndex));
            return true;
        }
        return super.$set(index + "", value, init, merge);
    }
    $get(index, resolveReference = true) {
        const parsedIndex = parseFloat(index);
        if (parsedIndex % 1 === 0 && parsedIndex >= this._count) {
            // Numeric indexes (or parsable) should not throw error but just return undefined
            return undefined;
        }
        return super.$get(index + "", resolveReference);
    }
    $at(index, resolveReferences = true) {
        return this.$get(index, resolveReferences);
    }
    $remove(child) {
        const trackID = this.$startTrackingChanges();
        for (let i = 0; i < this._count; i++) {
            const value = this.$get(i);
            if (value == child) {
                this.$removeIndex(i);
            }
        }
        this.$finishTrackingChanges(trackID);
    }
    $removeIndex(indexToRemove) {
        if (indexToRemove >= this._count)
            return;
        const trackID = this.$startTrackingChanges();
        const itemToRemove = this.$get(indexToRemove);
        // Shift all follow values over the one to remove
        for (let i = indexToRemove; i < this._count; i++) {
            const property = this.$property(i);
            const nextProperty = this.$property(i + 1);
            if (!property) {
                throw new Error(`Undefined property at index ${i} in range of Collection count.`);
            }
            if (!nextProperty) {
                this.$undefineProperty(i);
                continue;
            }
            const nextValue = nextProperty.value;
            // Move value from next property to this one
            property.set(nextValue);
        }
        this.$events.removed.fire(new CollectionItemRemovedEvent(itemToRemove, indexToRemove));
        this._count--;
        this.$finishTrackingChanges(trackID);
    }
    $clear() {
        const trackID = this.$startTrackingChanges();
        const removed = [];
        const count = this._count;
        // Remove all properties within Collection range
        for (let i = 0; i < this._count; i++) {
            const item = this.$get(i);
            removed.push(item);
            super.$undefineProperty(i + "");
        }
        this._count = 0;
        // Events
        for (let i = 0; i < count; i++) {
            this.$events.removed.fire(new CollectionItemRemovedEvent(removed[i], i));
        }
        this.$finishTrackingChanges(trackID);
    }
    $undefineProperty(index) {
        return super.$undefineProperty(index + "");
    }
    $map(func) {
        const results = [];
        for (let i = 0; i < this._count; i++) {
            const item = this._list[i];
            results.push(func(item, i));
        }
        return results;
    }
    $each(func) {
        this.$map(func);
    }
    $toArray() {
        return this.$map(item => item);
    }
    $length() {
        return this._count;
    }
    $export(options) {
        return this.$map(item => {
            if (item instanceof Mozel) {
                return item.$export(options);
            }
            return item;
        });
    }
    $notifyPropertyChanged(path) {
        super.$notifyPropertyChanged(path);
        // Update quick-access list if it's a direct property
        if (path.length !== 1) {
            return;
        }
        const property = path[0];
        if (!this.isCollectionIndex(property)) {
            return;
        }
        this._list[parseInt(property)] = this.$properties[property].value;
    }
}
//# sourceMappingURL=Collection.js.map