import logRoot from "./log";
import { isNil } from 'lodash';
import { uniqueId, values } from "./utils";
import EventInterface from "event-interface-mixin";
const log = logRoot.instance("registry");
export class RegistryItemAdded {
    constructor(item) {
        this.item = item;
    }
}
export class RegistryItemRemoved {
    constructor(item) {
        this.item = item;
    }
}
export class RegistryEvents extends EventInterface {
    constructor() {
        super(...arguments);
        this.added = this.$event(RegistryItemAdded);
        this.removed = this.$event(RegistryItemRemoved);
    }
}
export default class Registry {
    constructor() {
        this.id = uniqueId('registry-');
        this.events = new RegistryEvents();
        this.indexByGid = {};
    }
    register(item) {
        if (!isNil(item.gid)) {
            if (item.gid in this.indexByGid) {
                throw new Error(`Duplicate registration for GID: ${item.gid}.`);
            }
            else {
                this.indexByGid[item.gid] = item;
            }
        }
        this.events.added.fire(new RegistryItemAdded(item));
    }
    remove(item) {
        if (!isNil(item.gid)) {
            delete this.indexByGid[item.gid];
        }
        this.events.removed.fire(new RegistryItemRemoved(item));
    }
    find(gid) {
        if (!isNil(gid)) {
            let item = this.byGid(gid);
            if (item)
                return item;
        }
        return; // not found
    }
    byGid(gid, ExpectedClass) {
        const found = this.indexByGid[gid];
        if (ExpectedClass && !(found instanceof ExpectedClass)) {
            log.error(`Object with GID ${gid} was found, but was not a ${ExpectedClass.name}.`);
            return undefined;
        }
        return found;
    }
    /**
     * Find the current maximum numeric GID in the Registry. String values are ignored.
     */
    findMaxGid() {
        let max = 0;
        Object.keys(this.indexByGid).forEach((gid) => {
            const numeric = parseInt(gid);
            if (numeric.toString() !== gid)
                return; // gid is not an integer string index
            if (numeric > max)
                max = numeric;
        });
        return max;
    }
    all() {
        return values(this.indexByGid);
    }
}
//# sourceMappingURL=Registry.js.map