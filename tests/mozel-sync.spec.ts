import {assert} from 'chai';
import Mozel, {collection, Collection, property, Registry} from "../src";
import MozelSync, {MozelWatcher} from "../src/MozelSync";
import {alphanumeric} from "validation-kit";
import {Data} from "../src/Mozel";

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
		const watcher = new MozelWatcher('1', root);
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
		const watcher = new MozelWatcher('1', foo);
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
	describe("getUpdates", () => {
		it("returns all changes to all registered Mozels", () => {
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
			sync.register(root.foo!);
			sync.start();

			root.name = 'root2';
			root.foo!.name = 'root.foo2';
			root.foo!.foo = root.$create(Foo, {name: 'root.foo.foo'});

			const updates = sync.createUpdates();
			assert.deepEqual(Object.keys(updates), ['root', 'rootFoo'], "Correct entries in update.");

			assert.deepEqual(updates.root.changes, {
				name: 'root2'
			});
			assert.deepEqual(updates.rootFoo.changes, {
				name: 'root.foo2',
				foo: {gid: root.foo!.foo.gid}
			});
		});
		it("returns only a list of GIDs for changed collections", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@collection(Foo)
				foos!:Collection<Foo>
			}
			const foo = Foo.create<Foo>({
				gid: 'root',
				foos: [{gid: 'root.foos.0', name: 'RootFoos0'}, {gid: 'root.foos.1', name: 'RootFoos1'}]
			});
			const sync = new MozelSync();
			sync.syncRegistry(foo.$registry);
			sync.start();

			foo.foos.get(1)!.name = 'RootFoos1-changed';
			foo.foos.remove({gid: 'root.foos.0'});

			const updates = sync.createUpdates();

			assert.deepEqual(Object.keys(updates).sort(), ['root', 'root.foos.1'], "Correct entries in update.");
			assert.deepEqual(updates.root.changes, {
				foos: [{gid: 'root.foos.1'}]
			});
			assert.deepEqual(updates["root.foos.1"].changes, {
				name: 'RootFoos1-changed'
			});
		});
		it("returns only an object with GID for nested mozels, and an extra record for new mozels", () => {
			class Foo extends Mozel {
				@property(String)
				name?: string;
				@property(Foo)
				foo?:Foo;
			}
			const root = Foo.create<Foo>({
				gid: 'root',
				foo: {
					gid: 'root.foo',
					name: 'RootFoo'
				}
			});
			const sync = new MozelSync();
			sync.syncRegistry(root.$registry);
			sync.start();

			root.$set('foo', {gid: 'root.foo2', name: 'RootFoo2'}, true);
			const updates = sync.createUpdates();

			assert.deepEqual(Object.keys(updates), ['root', 'root.foo2'], "Correct entries in update.");
			assert.deepEqual(updates.root.changes, {
				foo: {gid: 'root.foo2'}
			});
			assert.deepEqual(updates["root.foo2"].changes, {
				gid: 'root.foo2',
				name: 'RootFoo2'
			});
		});
	});
	describe("register", () => {
		it("records current state as change if MozelSync already started", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
			}
			const foo = Foo.create<Foo>({
				gid: 'foo',
				name: 'foo'
			});
			const sync = new MozelSync();
			sync.start();
			sync.register(foo);

			const updates = sync.createUpdates();
			
			assert.deepEqual(Object.keys(updates), ['foo'], "Correct entries in update.");
			assert.deepEqual(updates.foo.changes, {
				gid: 'foo',
				name: 'foo'
			});
		});
	});
	describe("applyUpdates", () => {
		it("merges changes retrieved from getUpdates into the registered Mozels", () => {
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

			const updates = sync1.createUpdates();
			sync2.applyUpdates(updates);

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

			const updates = sync.createUpdates();
			assert.deepEqual(updates["root.foo"].changes, {
				name: "rootFoo"
			});
			assert.deepEqual(updates["root.foos.0"].changes, {
				name: "rootFoos0"
			});
		});
	});
	describe("2-way synchronization getUpdates -> applyUpdates", () => {
		it("can be applied without causing infinite loops", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(Foo)
				foo?:Foo;
				@collection(Foo)
				foos!:Collection<Foo>;
			}
			const setup = {
				gid: 'root',
				name: 'Root',
				foo: {
					gid: 'root.foo',
					name: 'RootFoo'
				},
				foos: [{gid: 'root.foos.0', name: 'RootFoos0'}, {gid: 'root.foos.1', name: 'RootFoos1'}]
			}
			const model1 = Foo.create<Foo>(setup);
			const model2 = Foo.create<Foo>(setup);

			const sync1 = new MozelSync();
			sync1.syncRegistry(model1.$registry);
			sync1.start();

			const sync2 = new MozelSync();
			sync2.syncRegistry(model2.$registry);
			sync2.start();

			assert.deepEqual(sync1.createUpdates(), {}, "No changes in sync1 at start");
			assert.deepEqual(sync2.createUpdates(), {}, "No changes in sync2 at start");

			model1.name = 'Root-2';
			model1.foo!.name = 'RootFoo-2';
			model1.foos.set(1, {gid: 'root.foos.1-2', name: 'RootFoos1-2'});

			sync2.applyUpdates(sync1.createUpdates());
			sync1.applyUpdates(sync2.createUpdates());

			const updates = sync1.createUpdates();

			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.deepEqual(updates, {}, "No more changes after synchronization changes were reported back");
		});
		it("non-conflicting changes made simultaneously are merged", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
				@property(String)
				bar?:string;
			}
			const model1 = Foo.create<Foo>({gid: 1});
			const model2 = Foo.create<Foo>({gid: 1});
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			sync1.start();
			sync2.start();

			model1.foo = 'foo';
			model2.bar = 'bar';

			sync2.applyUpdates(sync1.createUpdates());
			sync1.applyUpdates(sync2.createUpdates());

			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.equal(model1.foo, 'foo');
			assert.equal(model1.bar, 'bar');
		});
		it("conflicting changes are merged first-come-first-serve", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const model1 = Foo.create<Foo>({gid: 1});
			const model2 = Foo.create<Foo>({gid: 1});
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			sync1.start();
			sync2.start();

			model1.foo = 'foo';
			model2.foo = 'bar';

			// sync1 transmits first
			sync2.applyUpdates(sync1.createUpdates());
			sync1.applyUpdates(sync2.createUpdates());

			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.equal(model1.foo, 'foo');
		});
		it("conflicting changes crossing paths will be settled by MozelSync priority", () => {
			function transmit(sync1:MozelSync, sync2:MozelSync) {
				const changes1 = sync1.createUpdates();
				const changes2 = sync2.createUpdates();
				sync2.applyUpdates(changes1);
				sync1.applyUpdates(changes2);
			}
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const model1 = Foo.create<Foo>({gid: 1});
			const model2 = Foo.create<Foo>({gid: 1});
			const sync1 = new MozelSync({registry: model1.$registry, priority: 1});
			const sync2 = new MozelSync({registry: model2.$registry});
			sync1.start();
			sync2.start();

			model1.foo = 'foo';
			model2.foo = 'bar';

			transmit(sync1, sync2);
			transmit(sync1, sync2);

			assert.deepEqual(sync1.createUpdates(), {}, "No more changes in sync1 after round-trip");
			assert.deepEqual(sync2.createUpdates(), {}, "No more changes in sync2 after round-trip");
			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.equal(model2.foo, 'foo', "Property stettled to model1 value");
		});
	});
	describe("2-way synchronization with central model", () => {
		it("synchronizes all models", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const init = {gid: 1}

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const modelCentral = Foo.create<Foo>(init);

			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			const syncCentral = new MozelSync({registry: modelCentral.$registry});
			sync1.start();
			sync2.start();
			syncCentral.start();

			// model 1 is changed, transmits to central model
			model1.foo = 'foo';
			syncCentral.applyUpdates(sync1.createUpdates());

			// central model transmits to all clients
			sync2.applyUpdates(syncCentral.createUpdates());
			sync1.applyUpdates(syncCentral.createUpdates());

			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.deepEqual(modelCentral.$export(), model1.$export(), "Models synchronized with central model");
			assert.equal(model1.foo, 'foo');
		});
		it("resolves conflicting updates through high-priority central model at a first-come-first serve basis", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
				@property(String)
				bar?:string;
				@property(String)
				qux?:string;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const modelCentral = Foo.create<Foo>(init);

			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			const syncCentral = new MozelSync({registry: modelCentral.$registry, priority: 1});
			sync1.start();
			sync2.start();
			syncCentral.start();

			model1.foo = 'foo1';
			model1.qux = 'qux1';
			model2.bar = 'bar2';
			model2.qux = 'qux2';

			syncCentral.applyUpdates(sync1.createUpdates());
			syncCentral.applyUpdates(sync2.createUpdates());

			const centralUpdates = syncCentral.createUpdates();

			sync1.applyUpdates(centralUpdates);
			sync2.applyUpdates(centralUpdates);

			assert.equal(modelCentral.foo, 'foo1');
			assert.equal(modelCentral.bar, 'bar2');
			assert.equal(modelCentral.qux, 'qux1');
			assert.deepEqual(modelCentral.$export(), model1.$export(), "model1 synced with modelCentral");
			assert.deepEqual(modelCentral.$export(), model2.$export(), "model2 synced with modelCentral");
		});
		it("conflicting properties can overwrite changes in other MozelSyncs before they send their update", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const modelCentral = Foo.create<Foo>(init);

			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			const syncCentral = new MozelSync({registry: modelCentral.$registry, priority: 1});
			sync1.start();
			sync2.start();
			syncCentral.start();

			model1.foo = 'foo1';
			model2.foo = 'foo2';

			// 1 -> central
			syncCentral.applyUpdates(sync1.createUpdates());

			// central -> 1 & 2
			const centralUpdates1 = syncCentral.createUpdates();
			sync1.applyUpdates(centralUpdates1);
			sync2.applyUpdates(centralUpdates1);

			// 2 -> central
			syncCentral.applyUpdates(sync2.createUpdates());

			// central -> 1 & 2
			const centralUpdates2 = syncCentral.createUpdates();
			sync1.applyUpdates(centralUpdates2);
			sync2.applyUpdates(centralUpdates2);

			assert.equal(modelCentral.foo, 'foo1');
			assert.deepEqual(modelCentral.$export(), model1.$export(), "model1 synced with modelCentral");
			assert.deepEqual(modelCentral.$export(), model2.$export(), "model2 synced with modelCentral");
		});
	});
	describe("syncWith", () => {
		it("sends updates to linked MozelSyncs when `update` is called.", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const modelCentral = Foo.create<Foo>(init);
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			const syncCentral = new MozelSync({registry: modelCentral.$registry});
			syncCentral.syncWith(sync1);
			syncCentral.syncWith(sync2);

			sync1.start();
			sync2.start();
			syncCentral.start();

			model1.foo = 'foo';
			sync1.update();
			syncCentral.update();

			assert.equal(modelCentral.foo, 'foo');
			assert.equal(model2.foo, 'foo');
		});
	});
	describe("applyUpdates", () => {
		it("auto-cleans history based on the lowest received version number of linked MozelSyncs", () => {
			class Foo extends Mozel {
				@property(Number)
				foo?:number;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const modelCentral = Foo.create<Foo>(init);
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry});
			const syncCentral = new MozelSync({registry: modelCentral.$registry});

			sync1.start();
			sync2.start();
			syncCentral.start();

			model1.foo = 1;
			model2.foo = 2;

			syncCentral.applyUpdates(sync1.createUpdates()); // sync1: bv0 (v1)		>sync1.bv1

			let updates = syncCentral.createUpdates(); // (v2) >central.bv2
			sync1.applyUpdates(updates); // bv2
			sync2.applyUpdates(updates); // bv2
			syncCentral.applyUpdates(sync1.createUpdates()); // no update
			syncCentral.applyUpdates(sync2.createUpdates()); // sync2: bv2 (v3)		>sync2.bv2

			model1.foo = 3;
			syncCentral.applyUpdates(sync1.createUpdates()); // sync1: bv2 (v4)		>sync1.bv3

			const watcher = syncCentral.getWatcher(modelCentral.gid);
			assert.deepEqual(watcher.getSyncVersions(), {
				[sync1.id]: 2,
				[sync2.id]: 2
			}, "Sync versions correct");
			assert.notOk(
				!!watcher.getHistory().find(update => update.baseVersion <= 2),
				"No updates in history with base version below 3"
			);
		});
	});
});
