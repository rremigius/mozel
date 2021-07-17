import {assert} from 'chai';
import Mozel, {collection, property, string} from "../../Mozel";
import MozelSync from "../src/MozelSync";
import Collection from "../../Collection";
import Registry from "../../Registry";

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
		it("merges changes retrieved from createUpdates into the registered Mozels", () => {
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
		it("can synchronize Collection item removal", () => {
			class Foo extends Mozel {
				@collection(Foo)
				foos!:Collection<Foo>;
			}
			const init = {gid: 'root', foos: [{gid: 0}, {gid: 1}]};
			const foo1 = Foo.create<Foo>(init);
			const foo2 = Foo.create<Foo>(init);

			const sync1 = new MozelSync({registry: foo1.$registry});
			const sync2 = new MozelSync({registry: foo2.$registry});
			sync1.start();
			sync2.start();

			foo1.foos.removeIndex(0);
			sync2.applyUpdates(sync1.createUpdates(true));

			assert.deepEqual(foo1.$export(), foo2.$export(), "Mozels synchronized");
			assert.equal(foo2.foos.length, 1);
			assert.equal(foo2.foos.get(0)!.gid, 1);
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

			assert.deepEqual(sync1.createUpdates(true), {}, "No changes in sync1 at start");
			assert.deepEqual(sync2.createUpdates(true), {}, "No changes in sync2 at start");

			model1.name = 'Root-2';
			model1.foo!.name = 'RootFoo-2';
			model1.foos.set(1, {gid: 'root.foos.1-2', name: 'RootFoos1-2'});

			sync2.applyUpdates(sync1.createUpdates(true));
			sync1.applyUpdates(sync2.createUpdates(true));

			const updates = sync1.createUpdates(true);

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
				const changes1 = sync1.createUpdates(true);
				const changes2 = sync2.createUpdates(true);
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

			assert.deepEqual(sync1.createUpdates(true), {}, "No more changes in sync1 after round-trip");
			assert.deepEqual(sync2.createUpdates(true), {}, "No more changes in sync2 after round-trip");
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
	describe("applyUpdates", () => {
		it("auto-cleans history to keep a maximum number of entries", () => {
			class Foo extends Mozel {
				@property(Number)
				foo?:number;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry, historyLength: 2});

			sync1.start();
			sync2.start();

			model1.foo = 1;
			sync2.applyUpdates(sync1.createUpdates(true));
			model1.foo = 2;
			sync2.applyUpdates(sync1.createUpdates(true));
			model1.foo = 3;
			sync2.applyUpdates(sync1.createUpdates(true));
			model1.foo = 4;
			sync2.applyUpdates(sync1.createUpdates(true));

			const watcher = sync2.getWatcher(model2.gid);
			assert.equal(watcher.getHistory().length, 2, "History length kept at 2");
		});
		it("rejects updates with a base version lower than oldest update in history", () => {
			class Foo extends Mozel {
				@property(Number)
				foo?:number;
			}
			const init = {gid: 1};

			const model1 = Foo.create<Foo>(init);
			const model2 = Foo.create<Foo>(init);
			const sync1 = new MozelSync({registry: model1.$registry});
			const sync2 = new MozelSync({registry: model2.$registry, historyLength: 2});
			sync1.start();
			sync2.start();

			model1.foo = 1;
			const oldUpdate = sync1.createUpdates(true);

			model1.foo = 2;
			sync2.applyUpdates(sync1.createUpdates(true));
			model1.foo = 3;
			sync2.applyUpdates(sync1.createUpdates(true));
			model1.foo = 4;
			sync2.applyUpdates(sync1.createUpdates(true));

			assert.throws(()=>sync2.applyUpdates(oldUpdate));
		});
		it("merges updates based on base number", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
				@property(String)
				bar?:string;
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

			model1.foo = 'model1.foo';

			model2.foo = 'model2.foo';
			model2.bar = 'model2.bar';

			syncCentral.applyUpdates(sync1.createUpdates(true));
			sync1.applyUpdates(syncCentral.createUpdates(true)); // only sync to sync1, sync2 will be outdated

			model1.foo = 'model1.foo.2';
			model2.foo = 'model2.foo.2';

			// Both send in new update
			syncCentral.applyUpdates(sync1.createUpdates(true));
			syncCentral.applyUpdates(sync2.createUpdates(true));

			// Sync back to both
			const updates = syncCentral.createUpdates(true);
			sync1.applyUpdates(updates);
			sync2.applyUpdates(updates);

			assert.deepEqual(modelCentral.$export(), model1.$export(), "model1 in sync with modelCentral");
			assert.deepEqual(modelCentral.$export(), model2.$export(), "model2 in sync with modelCentral");
			assert.equal(modelCentral.foo, 'model1.foo.2', "Foo set to value provided by model1");
			assert.equal(modelCentral.bar, "model2.bar", "Bar set to value provided by model2");
		});
		it("can create sub-Mozels *and* fill in their data, even if data comes after property assignment", () => {
			class Foo extends Mozel {
				@string()
				name?:string;
				@property(Foo)
				foo?:Foo;
			}
			const root = Foo.create<Foo>({gid: 'root'});
			const sync = new MozelSync({registry: root.$registry});
			sync.applyUpdates({
				'new-gid': {
					syncID: 'foo',
					priority: 0,
					baseVersion: 0,
					version: 1,
					changes: {
						name: 'foo'
					}
				},
				'root': {
					syncID: 'foo',
					priority: 0,
					baseVersion: 0,
					version: 1,
					changes: {
						foo: {gid: 'new-gid'}
					}
				}
			});
			assert.deepEqual(root.$export(), {
				gid: 'root',
				name: undefined,
				foo: {
					gid: 'new-gid',
					name: 'foo',
					foo: undefined
				}
			})
		});
	});
});
