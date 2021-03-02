import { isString, isPlainObject, isArray, forEach, extend } from 'lodash';
import format from 'string-format';
export default class Templater {
    constructor(data) {
        this.data = {};
        if (data) {
            this.setData(data);
        }
    }
    setData(data) {
        if (!isPlainObject(data)) {
            console.warn("Cannot set Templater data, expected plain object.", data);
            return;
        }
        extend(this.data, data);
    }
    /**
     * Loads template data from an API.
     * @param {string|ApiOptions} options	The url to call.
     * @param {string} key	The key under which to store the result. Defaults to 'api'.
     * @return {Promise<void>}
     */
    async loadFromAPI(options, key = 'api') {
        let url;
        let fetchOptions = {};
        if (isString(options)) {
            url = options;
        }
        else {
            url = options.url;
            if (options.auth) {
                fetchOptions.headers = new Headers({
                    "Authorization": `Basic ${btoa(`${options.auth.user}:${options.auth.pass}`)}`
                });
            }
        }
        // Execute request
        let response = await fetch(url, fetchOptions);
        this.setData({
            [key]: await response.json()
        });
    }
    renderString(string) {
        return format(string, this.data);
    }
    /**
     * Renders any templates in the given data. If any API was called, its response can be used in the templates as well.
     *
     * @param data								The data to render templates into.
     * @param {object} values			An object of data accessible by the templates.
     * @return {*}
     */
    render(data, values) {
        if (isString(data)) {
            return this.renderString(data);
        }
        if (isPlainObject(data) || isArray(data)) {
            forEach(data, (value, key) => {
                data[key] = this.render(value, values);
            });
        }
        return data;
    }
}
;
//# sourceMappingURL=Templater.js.map