declare type Data = Record<string, any>;
export declare type ApiOptions = {
    url: string;
    auth?: {
        user: string;
        pass: string;
    };
};
export default class Templater {
    private data;
    constructor(data?: Data);
    setData(data: Data): void;
    /**
     * Loads template data from an API.
     * @param {string|ApiOptions} options	The url to call.
     * @param {string} key	The key under which to store the result. Defaults to 'api'.
     * @return {Promise<void>}
     */
    loadFromAPI(options: string | ApiOptions, key?: string): Promise<void>;
    renderString(string: string): string;
    /**
     * Renders any templates in the given data. If any API was called, its response can be used in the templates as well.
     *
     * @param data								The data to render templates into.
     * @param {object} values			An object of data accessible by the templates.
     * @return {*}
     */
    render(data: any, values?: Data): any;
}
export {};
