import { PropertyValue } from "./Property";
import Mozel from "./Mozel";
export declare type PropertyWatcherOptions = {
    path: string;
    handler: PropertyChangeHandler<PropertyValue>;
    immediate?: boolean;
    deep?: boolean;
    expect?: Function;
};
export declare type PropertyWatcherOptionsArgument = Omit<PropertyWatcherOptions, 'path' | 'handler'>;
export declare type PropertyChangeHandler<T> = (newValue: T, oldValue: T, path: string) => void;
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
    matches(path: string): boolean | undefined;
    applyMatchedPath(matchedPath: string): string;
}
