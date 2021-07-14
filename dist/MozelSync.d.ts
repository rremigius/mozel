import Mozel, { Data } from "./Mozel";
import { alphanumeric } from "validation-kit";
import { callback } from "event-interface-mixin";
import { Registry } from "./index";
export default class MozelSync {
    mozels: Record<alphanumeric, Mozel>;
    watchers: Record<alphanumeric, MozelWatcher>;
    listeners: Record<alphanumeric, callback<any>[]>;
    registryListeners: callback<any>[];
    registry?: Registry<Mozel>;
    active: boolean;
    getChanges(): Record<alphanumeric, Data>;
    applyChanges(changes: Record<string, Data>): void;
    clearChanges(): void;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
export declare class MozelWatcher {
    readonly mozel: Mozel;
    private watchers;
    private _changes;
    get changes(): Record<string, any>;
    onDestroyed: () => void;
    constructor(mozel: Mozel);
    clearChanges(): void;
    exportChanges(): Record<string, any>;
    start(): void;
    stop(): void;
    destroy(): void;
}
