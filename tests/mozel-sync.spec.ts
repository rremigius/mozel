import {assert} from 'chai';
import Mozel, {property} from "../src";
import MozelSync from "../src/MozelSync";

describe("MozelSync", () => {
	it("tracks all changes in the given Mozel", () => {
		class Foo extends Mozel {
			@property(String)
			name?:string;
			@property(Foo)
			foo?:Foo;
		}
		const root = Foo.create<Foo>({
			gid: 'root',
			name: 'root',
			foo: {
				gid: 'root.foo',
				name: 'root.foo',
				foo: {
					gid: 'root.foo.foo',
					name: 'root.foo.foo'
				}
			}
		});
		const sync = new MozelSync(root);
		sync.startWatching();

		root.foo!.foo = root.$create(Foo, {gid: 'root.foo.foo2'});
		root.foo!.name = 'root.foo2';
		root.name = 'root2';
		root.name = 'root3'

		assert.deepEqual(sync.changes, {
			'foo.foo': root.foo!.foo,
			'foo.name': 'root.foo2',
			'name': 'root3'
		});
	});
});
