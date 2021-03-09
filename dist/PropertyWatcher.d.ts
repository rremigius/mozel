import { PropertyValue } from "./Property";
import Mozel from "./Mozel";
export declare type PropertyWatcherOptions = {
    path: string;
    handler: PropertyChangeHandler;
    immediate?: boolean;
    deep?: boolean;
};
export declare type PropertyChangeHandler = (newValue: PropertyValue, oldValue: PropertyValue, path: string) => void;
export default class PropertyWatcher {
    readonly mozel: Mozel;
    readonly path: string;
    readonly immediate?: boolean;
    readonly deep?: boolean;
    private readonly handler;
    private currentValues;
    constructor(mozel: Mozel, options: PropertyWatcherOptions);
    execute(path: string): void;
    updateValues(path: string): void;
    matches(path: string): boolean;
    applyMatchedPath(matchedPath: string): string;
}
