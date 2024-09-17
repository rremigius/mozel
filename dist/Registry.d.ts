import { Class, alphanumeric } from "validation-kit";
import EventInterface, { EventEmitter } from "event-interface-mixin";
export type Registerable = {
    id?: alphanumeric;
    gid?: alphanumeric;
};
export declare class RegistryItemAdded<T> {
    item: T;
    constructor(item: T);
}
export declare class RegistryItemRemoved<T> {
    item: T;
    constructor(item: T);
}
export declare class RegistryEvents<T> extends EventInterface {
    added: EventEmitter<RegistryItemAdded<T>>;
    removed: EventEmitter<RegistryItemRemoved<T>>;
}
export default class Registry<T extends Registerable> {
    readonly id: string;
    readonly events: RegistryEvents<unknown>;
    private indexByGid;
    register(item: T): void;
    remove(item: T): void;
    find(gid?: alphanumeric): T | undefined;
    byGid<E extends T>(gid: alphanumeric, ExpectedClass?: Class): E | undefined;
    all(): T[];
}
