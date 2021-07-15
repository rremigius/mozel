import Mozel, { Data } from "./Mozel";
import { alphanumeric } from "validation-kit";
import { callback } from "event-interface-mixin";
import { Registry } from "./index";
export declare type Changes = Record<alphanumeric, Data>;
export default class MozelSync {
    mozels: Record<alphanumeric, Mozel>;
    watchers: Record<alphanumeric, MozelWatcher>;
    listeners: Record<alphanumeric, callback<any>[]>;
    registryListeners: callback<any>[];
    registry?: Registry<Mozel>;
    active: boolean;
    priority: number | undefined;
    constructor(options?: {
        registry?: Registry<Mozel>;
        priority?: number;
    });
    createUpdates(): Record<alphanumeric, Update>;
    applyUpdates(updates: Record<alphanumeric, Update>): void;
    clearChanges(): void;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
export declare type Update = {
    version: number;
    priority: number;
    baseVersion: number;
    changes: Record<string, any>;
};
export declare class MozelWatcher {
    readonly mozel: Mozel;
    private watchers;
    private _changes;
    get changes(): Record<string, any>;
    private version;
    private history;
    priority: number;
    onDestroyed: () => void;
    constructor(mozel: Mozel, priority?: number);
    applyUpdate(update: Update): void;
    overrideChangesFromHistory(update: Update): {
        [x: string]: any;
    };
    removeChanges(changes: Changes, override: Changes): Changes;
    clearChanges(): void;
    createUpdate(): Update;
    start(includeCurrentState?: boolean): void;
    stop(): void;
    destroy(): void;
}
