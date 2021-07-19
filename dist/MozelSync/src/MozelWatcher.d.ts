import Mozel from "../../Mozel";
import EventInterface from "event-interface-mixin";
export declare type Changes = Record<string, any>;
export declare class OutdatedUpdateError extends Error {
    baseVersion: number;
    requiredVersion: number;
    constructor(baseVersion: number, requiredVersion: number);
}
export declare type Commit = {
    syncID: string;
    version: number;
    priority: number;
    baseVersion: number;
    changes: Changes;
};
export declare class MozelWatcherChangedEvent {
    changePath: string;
    constructor(changePath: string);
}
export declare class MozelWatcherEvents extends EventInterface {
    changed: import("event-interface-mixin").EventEmitter<MozelWatcherChangedEvent>;
}
export declare class MozelWatcher {
    readonly mozel: Mozel;
    private watchers;
    private _changes;
    get changes(): Changes;
    private newMozels;
    private mozelsInUpdates;
    private stopCallbacks;
    private priority;
    private version;
    private historyMaxLength;
    private history;
    get historyMinBaseVersion(): number;
    get lastUpdate(): Commit | undefined;
    syncID: string;
    readonly events: MozelWatcherEvents;
    private onDestroyed;
    /**
     *
     * @param mozel
     * @param options
     * 			options.asNewMozel	Function to check whether a Mozel property is new and should be included in full
     */
    constructor(mozel: Mozel, options?: {
        syncID?: string;
        priority?: number;
        historyLength?: number;
    });
    isNewMozel(mozel: Mozel): boolean;
    /**
     * Merges the update into the current Mozel.
     * Returns the final update, with all overrides removed, and its own priority applied
     * @param update
     */
    merge(update: Commit): Commit;
    overrideChangesFromHistory(update: Commit): {
        [x: string]: any;
    };
    /**
     *
     * @param {Changes} changes
     * @param {Changes} override
     */
    removeChanges(changes: Changes, override: Changes): Changes;
    clearChanges(): void;
    getHistory(): Commit[];
    autoCleanHistory(): void;
    hasChanges(): boolean;
    createUpdateInfo(): Commit;
    createFullState(): Commit;
    commit(): Commit | undefined;
    isEqualChangeValue(value1: unknown, value2: unknown): boolean;
    start(includeCurrentState?: boolean): void;
    stop(): void;
    destroy(): void;
}
