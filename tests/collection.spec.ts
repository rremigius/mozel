import {assert} from 'chai';
import {describe, it} from 'mocha';

import Mozel, {property, reference, required, string} from "../src/Mozel";
import Collection, {collection} from "../src/Collection";

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

			const modifiedPaths:string[] = [];

			let changes = 0;
			foo.$watch('items.*', () => {
				changes++;
			});
			foo.$watch('items.*.*', ({valuePath}) => {
				modifiedPaths.push(valuePath.join('.'));
			});

			foo.items.$setData([{gid: 1, foo: 'a'}, {gid: 2, foo: 'B'}, {gid: 4, foo: 'd'}], true);

			assert.equal(changes, 1, "collection notifications correct");
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
	it("references are lazy-loaded", () => {
		class Foo extends Mozel {
			@collection(Foo, {reference}, {required})
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
