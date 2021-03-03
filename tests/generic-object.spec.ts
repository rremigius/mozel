import { assert } from 'chai';
import GenericMozel from "../src/GenericMozel";

describe('GenericMozel', () => {
	it('.create defines properties based on the given data.', () => {
		let obj = GenericMozel.create({
			foo: 'bar'
		});
		assert.ok(obj.hasProperty('foo'), "Property 'foo' defined");
		assert.equal(obj.get('foo'), 'bar', "Property 'foo' has correct value");
	});
	it('.set() defines Properties based on those properties.', () => {
		let obj = <{[key:string]:any}>new GenericMozel();
		obj.set('foo', 'bar');
		assert.ok(obj.hasProperty('foo'), "Property 'foo' defined");
		assert.equal(obj.foo, 'bar', "Property 'foo' as correct value via property.");
		assert.equal(obj.get('foo'), 'bar', "Property 'foo' has correct value via get() method.");
		assert.equal(obj.export().foo, 'bar', "Property 'foo' has correct value via export() method.");
	});
});
