export {
	get,
	set,
	isPlainObject,
	isArray,
	isString,
	isBoolean,
	isNil,
	isFunction,
	isEmpty,
	uniqueId,
	debounce,
	has,
	includes,
	forEach,
	remove,
	mapValues,
	values,
	omit,
	isNumber,
	throttle
} from "lodash";

export function interval(ms:number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}
