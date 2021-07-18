import {isPlainObject, concat} from "lodash";

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
	throttle,
	isEqual,
	find
} from "lodash";

export function interval(ms:number) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function call(func:Function) {
	return func();
}

export function findDeep(object:Record<string, any>, predicate:(value:unknown, key:string) => boolean):Record<string, unknown>|undefined {
	for(let key in object) {
		const value = object[key];
		if(predicate(key, value)) {
			return {[key]: value};
		}
		if(isPlainObject(value) || Array.isArray(value)) {
			return findDeep(value, predicate);
		}
	}
}
export function findAllDeep(object:Record<string, any>, predicate:(value:unknown, key:string) => boolean) {
	let found:Record<string, any>[] = [];
	for(let key in object) {
		const value = object[key];
		if(predicate(key, value)) {
			found.push({[key]: value});
		}
		if(isPlainObject(value) || Array.isArray(value)) {
			found = found.concat(found, findAllDeep(value, predicate));
		}
	}
	return found;
}
