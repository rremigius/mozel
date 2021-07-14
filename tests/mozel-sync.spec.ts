import {assert} from 'chai';
import Mozel, {collection, Collection, property, Registry} from "../src";
import MozelSync, {MozelWatcher} from "../src/MozelSync";

describe("MozelWatcher", () => {
	it("tracks all changes in the given Mozel's properties", () => {
		class Foo extends Mozel {
			@property(String)
			name?:string;
			@property(Foo)
			foo?:Foo;
		}
		const root = Foo.create<Foo>({
			gid: 'root',
			name: 'root'
		});
		const watcher = new MozelWatcher(root);
		watcher.start();

		root.foo = root.$create(Foo, {gid: 'root.foo.foo2'});
		root.foo!.name = 'root.foo2'; // should not be recorded
		root.name = 'root2';
		root.name = 'root3'

		assert.deepEqual(watcher.changes, {
			'foo': root!.foo,
			'name': 'root3'
		});
	});
	it("tracks changes to a Mozel's collection", () => {
		class Foo extends Mozel {
			@property(String)
			name?:string;
			@collection(Foo)
			foos!:Collection<Foo>
		}
		const foo = Foo.create<Foo>({
			gid: 'root',
			foos: [{gid: 'rootFoo', name: 'rootFoo'}]
		});
		const watcher = new MozelWatcher(foo);
		watcher.start();

		foo.foos.get(0)!.name = 'rootFoo2';
		assert.isEmpty(watcher.changes, "change to collection item does is not recorded");

		foo.foos.set(0, {gid: 'replaced'}, true);
		assert.deepEqual(watcher.changes, {
			foos: foo.foos
		});
	});
});

describe("MozelSync", () => {
	it("tracks all changes to all registered Mozels", () => {
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
				gid: 'rootFoo',
				name: 'root.foo'
			}
		});
		const sync = new MozelSync();
		sync.register(root);
		sync.start();
		sync.register(root.foo!); // watchers registered after start will start immediately

		root.name = 'root2';
		root.foo!.name = 'root.foo2';
		root.foo!.foo = root.$create(Foo, {name: 'root.foo.foo'});

		const changes = sync.getChanges();
		assert.deepEqual(changes, {
			root: {
				name: 'root2'
			},
			rootFoo: {
				name: 'root.foo2',
				foo: {gid: root.foo!.foo.gid, name: 'root.foo.foo', foo: undefined}
			}
		});
	});
	describe("applyChanges", () => {
		it("merges changes retrieved from getChanges into the registered Mozels", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(Foo)
				foo?:Foo;
				@collection(Foo)
				foos!:Collection<Foo>
			}
			const data = {
				name: 'root',
				foo: {gid: 'root.foo'},
				foos: [{gid: 'root.foos.0'}]
			}
			const root1 = Foo.create<Foo>(data);
			const root2 = Foo.create<Foo>(data);

			const sync1 = new MozelSync();
			sync1.register(root1);
			sync1.register(root1.foo!);
			sync1.register(root1.foos.get(0)!);
			sync1.start();

			const sync2 = new MozelSync();
			sync2.register(root2);
			sync2.register(root2.foo!);
			sync2.register(root2.foos.get(0)!);

			root1.foo!.name = 'rootFoo';
			root1.foos.get(0)!.name = 'rootFoos0';

			const changes = sync1.getChanges();
			sync2.applyChanges(changes);

			assert.equal(root2.foo!.name, 'rootFoo');
			assert.equal(root2.foos.get(0)!.name, 'rootFoos0');
		});
	});
	describe("syncRegistry", () => {
		it("registers and unregisters all Mozels registers/unregisters in MozelSync", () => {
			const registry = new Registry<Mozel>();
			const sync = new MozelSync();
			sync.syncRegistry(registry);

			const mozel1 = new Mozel();
			registry.register(mozel1);

			assert.ok(sync.has(mozel1), "mozel1 registered in sync");

			registry.remove(mozel1);

			assert.notOk(sync.has(mozel1), "mozel1 unregistered in sync");
		});
		it("collects changes to all mozels in Registry", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(Foo)
				foo?:Foo;
				@collection(Foo)
				foos!:Collection<Foo>
			}
			const root = Foo.create<Foo>({
				gid: 'root',
				name: 'root',
				foo: {gid: 'root.foo'},
				foos: [{gid: 'root.foos.0'}]
			});

			const sync = new MozelSync();
			sync.syncRegistry(root.$registry);
			sync.start();

			root.foo!.name = 'rootFoo';
			root.foos.get(0)!.name = 'rootFoos0';

			const changes = sync.getChanges();
			assert.deepEqual(changes, {
				"root.foo": {
					"name": "rootFoo"
				},
				"root.foos.0": {
					"name": "rootFoos0"
				}
			});
		});
	});
});
