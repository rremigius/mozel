import logRoot from "./log";
import { isNil } from 'lodash';
import { uniqueId, values } from "lodash";
import EventInterface from "event-interface-mixin";
const log = logRoot.instance("registry");
export class RegistryItemAdded {
    item;
    constructor(item) {
        this.item = item;
    }
}
export class RegistryItemRemoved {
    item;
    constructor(item) {
        this.item = item;
    }
}
export class RegistryEvents extends EventInterface {
    added = this.$event(RegistryItemAdded);
    removed = this.$event(RegistryItemRemoved);
}
export default class Registry {
    id = uniqueId('registry-');
    events = new RegistryEvents();
    indexByGid = {};
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
    all() {
        return values(this.indexByGid);
    }
}
//# sourceMappingURL=Registry.js.map