import {assert} from 'chai';
import {describe, it} from 'mocha';

import Mozel, {collection, deep, property} from "../src/Mozel";
import Collection, {
	CollectionChangedEvent,
	CollectionItemAddedEvent,
	CollectionItemRemovedEvent
} from "../src/Collection";
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
			foo.other.events.changed.on(event => {
				assert.ok(event.item instanceof FooMozel);
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
			foo.other.events.changed.on(() => {
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
			foo.items.events.changed.on(event => {
				assert.instanceOf(event.item, FooMozel);
				const model = event.item as FooMozel;
				added.push(model.gid);
			});
			foo.items.events.removed.on(event => {
				assert.instanceOf(event.item, FooMozel);
				const model = event.item as FooMozel;
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
	describe("CollectionItemAddedEvent", () => {
		class Foo extends Mozel {
			@collection(Number)
			items!:Collection<number>;
		}
		it("is fired if `add` is called", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});
			let count = 0;
			foo.items.events.added.on(event => {
				assert.equal(event.item, 5);
				assert.equal(event.index, 3);
				count++;
			});
			foo.items.add(5);
			assert.equal(count, 1, "event called exactly 1 time");
		});
		it("is fired if setData added an item to the collection that was not there before", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});
			let count = 0;
			foo.items.events.added.on(event => {
				assert.equal(event.item, 4);
				assert.equal(event.index, 2);
				count++;
			});
			foo.items.setData([2,3,4]);
			assert.equal(count, 1, "event called exactly 1 time");
		});
	});
	describe("CollectionItemRemovedEvent", () => {
		class Foo extends Mozel {
			@collection(Number)
			items!:Collection<number>;
		}
		it("is fired if `remove` is called", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});
			let count = 0;
			foo.items.events.removed.on(event => {
				assert.equal(event.item, 1);
				assert.equal(event.index, 0);
				count++;
			});
			foo.items.remove(1);
			assert.equal(count, 1, "event called exactly 1 time");
		});
		it("is fired if setData did not include an item in the collection that was there before", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});
			let count = 0;
			foo.items.events.removed.on(event => {
				assert.equal(event.item, 1);
				assert.equal(event.index, 0);
				count++;
			});
			foo.items.setData([2,3,4]);
			assert.equal(count, 1, "event called exactly 1 time");
		});
	});
});
