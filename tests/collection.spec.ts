import {assert} from 'chai';
import {describe, it} from 'mocha';

import Mozel, {property, reference, required, string} from "../src/Mozel";
import Collection, {collection} from "../src/Collection";
import {alphanumeric} from "validation-kit";

describe("Collection", () => {
	it("changed event is fired when any of its indexes change", () => {
		const collection = Collection.create<Collection<number>>([1,2,3,4]);
		let count = 0;
		collection.$events.changed.on(()=>{
			count++;
		});
		collection.$setData([1,3,4]);
		assert.isAbove(count, 1);
	});
	describe("setData", () => {
		it("adds/removes/updates based on diff", () => {
			class FooMozel extends Mozel {
				@property(String)
				foo?:string;
				@collection(FooMozel, undefined, {required})
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
			foo.items.$events.added.on(event => {
				assert.instanceOf(event.item, FooMozel);
				const model = event.item as FooMozel;
				added.push(model.gid);
			});
			foo.items.$events.removed.on(event => {
				assert.instanceOf(event.item, FooMozel);
				const model = event.item as FooMozel;
				removed.push(model.gid);
			});

			foo.items.$setData([{gid: 1, foo: 'a'}, {gid: 2, foo: 'B'}, {gid: 4, foo: 'd'}], true);

			assert.equal(changes, 1, "collection notifications correct");
			assert.deepEqual(added, [4], "'added' notifications correct");
			assert.deepEqual(removed, [3], "'removed' notifications correct");
			assert.deepEqual(modifiedPaths, [
				'items.1.foo',
				'items.2.gid',
				'items.2.foo',
				'items.2.items'
			], "'modifiedPaths' correct");
		});
		it("will not overwrite item data if only gids are provided", () => {
			class Foo extends Mozel {
				@string()
				foo?:string;
				@collection(Foo, undefined, {required})
				foos!:Collection<Foo>
			}
			const model = Foo.create<Foo>({
				foos: [{gid: 1, foo: 'a'}, {gid: 2, foo: 'b'}]
			});
			model.foos.$setData([{gid:2}]);
			assert.deepEqual(model.foos.$map(item => item.foo), ['b']);
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
			foo.items.$events.added.on(event => {
				assert.equal(event.item, 5);
				assert.equal(event.index, 3);
				count++;
			});
			foo.items.$add(5);
			assert.equal(count, 1, "event called exactly 1 time");
		});
		it("is fired for each new item at each new position", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});

			const added: number[] = [];
			const addedIndexes: number[] = [];
			foo.items.$events.added.on(event => {
				added.push(event.item);
				addedIndexes.push(event.index);
			});
			foo.items.$setData([3,2,1]);
			assert.deepEqual(added, [3, 1]);
			assert.deepEqual(addedIndexes, [0, 2]);
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
			foo.items.$events.removed.on(event => {
				assert.equal(event.item, 1);
				assert.equal(event.index, 0);
				count++;
			});
			foo.items.$remove(1);
			assert.equal(count, 1, "event called exactly 1 time");
		});
		it("is fired for each index from which an item was removed", () => {
			const foo = Foo.create<Foo>({items: [1,2,3]});
			const removed:number[] = [];
			const removedIndexes:number[] = [];
			foo.items.$events.removed.on(event => {
				removed.push(event.item);
				removedIndexes.push(event.index);
			});
			foo.items.$setData([3,2,1]);
			assert.deepEqual(removed, [1, 3]);
			assert.deepEqual(removedIndexes, [0, 2]);
		});
	});
	it("references are lazy-loaded", () => {
		class Foo extends Mozel {
			@collection(Foo, undefined, {required})
			refs!:Collection<Foo>;
			@collection(Foo)
			foos!:Collection<Foo>;
		}

		const foo = Foo.create<Foo>({
			refs: [{gid: 1}],
			foos: [{gid: 1}]
		});
		assert.notExists(foo.refs.$at(0, false), "Reference not yet resolved.");
		assert.exists(foo.refs.$at(0), "Reference can be accessed");
		assert.exists(foo.refs.$at(0, false), "Reference resolved.");
	});
});
