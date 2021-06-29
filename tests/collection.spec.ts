import {assert} from 'chai';
import {describe,it} from 'mocha';

import Mozel, {collection, deep, property, schema} from "../src/Mozel";
import Collection from "../src/Collection";
import {alphanumeric} from "validation-kit";

describe("Collection", () => {
	describe("onAdded", () => {
		it("adds a listener that will be called when an item is added", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			let assertions = 0;
			foo.other.onAdded(item => {
				assert.ok(item instanceof FooMozel);
				assertions++;
			});
			foo.other.add(bar);
			assert.equal(assertions, 1, "Right number of listeners called");
		});
	});
	describe("onRemoved", () => {
		it("adds a listener that will be called when an item is removed", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			let assertions = 0;
			foo.other.onRemoved(item => {
				assert.ok(item instanceof FooMozel);
				assertions++;
			});
			foo.other.add(bar);
			foo.other.remove(bar);
			assert.equal(assertions, 1, "Right number of listeners called");
		});
	});
	describe("setData", () => {
		it("adds/removes/updates based on diff", () => {
			class FooMozel extends Mozel {
				@property(String)
				foo?:string;
				@collection(FooMozel)
				items!:Collection<FooMozel>;
			}
			let foo = FooMozel.createFactory().create(FooMozel, {
				gid: 'root',
				items: [{gid: 1, foo: 'a'}, {gid: 2, foo: 'b'}, {gid: 3, foo: 'c'}]
			});

			const added:alphanumeric[] = [];
			const removed:alphanumeric[] = [];
			const modifiedPaths:string[] = [];

			let changes = 0;
			foo.$watch('items.*', (newItem, oldItem, path) => {
				changes++;
			});
			foo.$watch('items.*.*', (newValue, oldValue, path) => {
				modifiedPaths.push(path);
			});
			foo.items.onAdded(item => added.push((<FooMozel>item).gid));
			foo.items.onRemoved(item => removed.push((<FooMozel>item).gid));

			foo.items.setData([{gid: 1, foo: 'a'}, {gid: 2, foo: 'B'}, {gid: 4, foo: 'd'}], true);

			assert.equal(changes, 2, "collection notifications correct");
			assert.deepEqual(added, [4], "'added' notifications correct");
			assert.deepEqual(removed, [3], "'removed' notifications correct");
			assert.deepEqual(modifiedPaths, [
				'items.1.foo',
				'items.2.gid',
				'items.2.foo',
				'items.2.items'
			], "'changedPaths' correct");
		});
	});
});
