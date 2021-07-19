import {assert} from 'chai';
import Mozel, {collection, property, reference, string} from "../../Mozel";
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

			const updates = sync.commit();
			assert.deepEqual(Object.keys(updates), ['root', 'rootFoo'], "Correct entries in update.");

			assert.deepEqual(updates.root.changes, {
				name: 'root2'
			});
			assert.deepEqual(updates.rootFoo.changes, {
				name: 'root.foo2',
				foo: {gid: root.foo!.foo.gid, name: 'root.foo.foo', foo: undefined}
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

			const updates = sync.commit();

			assert.deepEqual(Object.keys(updates).sort(), ['root', 'root.foos.1'], "Correct entries in update.");
			assert.deepEqual(updates.root.changes, {
				foos: [{gid: 'root.foos.1'}]
			});
			assert.deepEqual(updates["root.foos.1"].changes, {
				name: 'RootFoos1-changed'
			});
		});
		it("returns only an object with GID for nested mozels, except for new child mozels", () => {
			class Foo extends Mozel {
				@property(String)
				name?: string;
				@property(Foo)
				newFoo?:Foo;
				@property(Foo)
				changedFoo?:Foo;
				@property(Foo, {reference})
				ref?:Foo;
			}
			const root = Foo.create<Foo>({
				gid: 'root',
				changedFoo: {
					gid: 'root.changedFoo',
					name: 'ChangedFoo'
				}
			});
			const sync = new MozelSync();
			sync.syncRegistry(root.$registry);
			sync.start();

			root.$set('newFoo', {gid: 'root.newFoo', name: 'NewFoo'}, true);
			root.changedFoo!.name = 'ChangedFoo-1';
			root.$set('ref', {gid: 'root.changedFoo'}, true);
			const updates = sync.commit();

			assert.deepEqual(Object.keys(updates).sort(), ['root', 'root.changedFoo'].sort(), "Correct entries in update.");
			assert.deepEqual(updates.root.changes, {
				newFoo: {gid: 'root.newFoo', name: 'NewFoo', changedFoo: undefined, newFoo: undefined, ref: undefined},
				ref: {gid: 'root.changedFoo'}
			});
			assert.deepEqual(updates['root.changedFoo'].changes, {
				name: 'ChangedFoo-1'
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

			const updates = sync1.commit();
			sync2.merge(updates);

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
			sync2.merge(sync1.commit());

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

			const updates = sync.commit();
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

			assert.deepEqual(sync1.commit(), {}, "No changes in sync1 at start");
			assert.deepEqual(sync2.commit(), {}, "No changes in sync2 at start");

			model1.name = 'Root-2';
			model1.foo!.name = 'RootFoo-2';
			model1.foos.set(1, {gid: 'root.foos.1-2', name: 'RootFoos1-2'});

			sync2.merge(sync1.commit());
			sync1.merge(sync2.commit());

			const updates = sync1.commit();

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

			sync2.merge(sync1.commit());
			sync1.merge(sync2.commit());

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
			sync2.merge(sync1.commit());
			sync1.merge(sync2.commit());

			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.equal(model1.foo, 'foo');
		});
		it("conflicting changes crossing paths will be settled by MozelSync priority", () => {
			function transmit(sync1:MozelSync, sync2:MozelSync) {
				const changes1 = sync1.commit();
				const changes2 = sync2.commit();
				sync2.merge(changes1);
				sync1.merge(changes2);
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

			assert.deepEqual(sync1.commit(), {}, "No more changes in sync1 after round-trip");
			assert.deepEqual(sync2.commit(), {}, "No more changes in sync2 after round-trip");
			assert.deepEqual(model1.$export(), model2.$export(), "Models synchronized");
			assert.equal(model2.foo, 'foo', "Property stettled to model1 value");
		});
	});
	describe("2-way synchronization with central model", () => {
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

			const updates1 = sync1.commit();
			syncCentral.merge(updates1);
			sync2.merge(updates1);

			assert.notOk(syncCentral.hasChanges(), "No updates from central after update1");

			const updates2 = sync2.commit();
			syncCentral.merge(updates2);
			sync1.merge(updates2);

			assert.notOk(syncCentral.hasChanges(), "No updates from central after update2");

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

			const updates1 = sync1.commit();
			syncCentral.merge(updates1);
			sync2.merge(updates1);

			const updates2 = sync2.commit();
			syncCentral.merge(updates2);
			sync2.merge(updates2);

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
			sync2.merge(sync1.commit());
			model1.foo = 2;
			sync2.merge(sync1.commit());
			model1.foo = 3;
			sync2.merge(sync1.commit());
			model1.foo = 4;
			sync2.merge(sync1.commit());

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
			const oldUpdate = sync1.commit();

			model1.foo = 2;
			sync2.merge(sync1.commit());
			model1.foo = 3;
			sync2.merge(sync1.commit());
			model1.foo = 4;
			sync2.merge(sync1.commit());

			assert.throws(()=>sync2.merge(oldUpdate));
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

			model1.foo = 'model1.foo'; // will be first
			model2.bar = 'model2.bar'; // will be too late (see below)

			const update1 = sync1.commit();
			const updateC1 = syncCentral.merge(update1); // only sync to central; sync2 will be outdated

			model1.bar = 'model1.bar'; // will be sent in later so not applied
			model2.foo = 'model2.foo'; // was already set by sync1 in previous update so not applied

			// Both send in new update
			const update1_2 = sync1.commit();
			const update2 = sync2.commit();
			const updateC2 = syncCentral.merge(update2); // update 2 first (but has lower baseVersion)
			const updateC1_2 = syncCentral.merge(update1_2);

			// SyncCentral sends to others (with its own priority)
			sync2.merge(updateC1); // as well as belated update
			sync1.merge(updateC2);
			sync2.merge(updateC1_2);

			assert.deepEqual(modelCentral.$export(), model1.$export(), "model1 in sync with modelCentral");
			assert.deepEqual(modelCentral.$export(), model2.$export(), "model2 in sync with modelCentral");
			assert.equal(modelCentral.foo, 'model1.foo', "Foo set to value provided by model1");
			assert.equal(modelCentral.bar, "model1.bar", "Bar set to value provided by model2");
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
			sync.merge({
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
