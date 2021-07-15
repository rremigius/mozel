import Mozel, { Data } from "./Mozel";
import { alphanumeric } from "validation-kit";
import { Registry } from "./index";
export declare type Changes = Record<alphanumeric, Data>;
export default class MozelSync {
    private _id;
    get id(): string;
    private mozels;
    private watchers;
    private listeners;
    private registryListeners;
    private registry?;
    private syncs;
    private active;
    priority: number | undefined;
    constructor(options?: {
        registry?: Registry<Mozel>;
        priority?: number;
    });
    createUpdates(): Record<alphanumeric, Update>;
    applyUpdates(updates: Record<alphanumeric, Update>): void;
    update(): void;
    getWatcher(gid: alphanumeric): MozelWatcher;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    syncWith(sync: MozelSync, twoWay?: boolean): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
export declare type Update = {
    syncID: string;
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
    private syncID;
    /**
     * A map of other MozelSyncs and the highest version received from them.
     * @private
     */
    private syncBaseVersions;
    priority: number;
    onDestroyed: () => void;
    constructor(syncID: string, mozel: Mozel, priority?: number);
    applyUpdate(update: Update): void;
    overrideChangesFromHistory(update: Update): {
        [x: string]: any;
    };
    removeChanges(changes: Changes, override: Changes): Changes;
    clearChanges(): void;
    getHistory(): Update[];
    autoCleanHistory(): void;
    clearHistory(fromBaseVersion?: number): void;
    createUpdate(): Update | undefined;
    getSyncVersions(): {
        [x: string]: number;
    };
    start(includeCurrentState?: boolean): void;
    stop(): void;
    destroy(): void;
}
