import {assert} from 'chai';
import {describe, it} from 'mocha';

import Mozel, {collection, deep, property} from "../src/Mozel";
import Collection, {CollectionChangedEvent, CollectionItemRemovedEvent} from "../src/Collection";
import {alphanumeric} from "validation-kit";

describe("Collection", () => {
	describe("on(ChangedEvent)", () => {
		it("callback is fired when an item is added to the Collection", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			let assertions = 0;
			foo.other.on(CollectionChangedEvent, event => {
				assert.ok(event.data.item instanceof FooMozel);
				assertions++;
			});
			foo.other.add(bar);
			assert.equal(assertions, 1, "Right number of listeners called");
		});
		it("callback is fired when an item is removed from the Collection", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			foo.other.add(bar);

			let assertions = 0;
			foo.other.on(CollectionChangedEvent, () => {
				assertions++;
			});
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
			foo.$watch('items.*', () => {
				changes++;
			});
			foo.$watch('items.*.*', ({valuePath}) => {
				modifiedPaths.push(valuePath);
			});
			foo.items.on(CollectionChangedEvent, event => {
				assert.instanceOf(event.data.item, FooMozel);
				const model = event.data.item as FooMozel;
				added.push(model.gid);
			});
			foo.items.on(CollectionItemRemovedEvent, event => {
				assert.instanceOf(event.data.item, FooMozel);
				const model = event.data.item as FooMozel;
				removed.push(model.gid);
			});

			foo.items.setData([{gid: 1, foo: 'a'}, {gid: 2, foo: 'B'}, {gid: 4, foo: 'd'}], true);

			assert.equal(changes, 1, "collection notifications correct");
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
