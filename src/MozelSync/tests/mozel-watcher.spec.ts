import Mozel, {collection, number, property, string} from "../../Mozel";
import {MozelWatcher} from "../src/MozelWatcher";
import {assert} from "chai";
import Collection from "../../Collection";

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
	it("for Mozel properties or Collections, only gid is included, unless it is a new Mozel", () => {
		class Foo extends Mozel {
			@string()
			name?:string;
			@property(Foo)
			foo?:Foo;
			@collection(Foo)
			foos!:Collection<Foo>
		}
		const root = Foo.create<Foo>({
			gid: 'root',
			name: 'RootFoo',
			foo:{gid: 'root.foo'},
			foos:[{gid: 'root.foos.0'}]
		});
		const watcher = new MozelWatcher(root);
		watcher.start();

		root.$set('foo', {gid: 'root.foo-2', name: 'RootFoo-2'}, true);
		root.foos.get(0)!.name = 'RootFoos0'
		root.foos.set(1, {gid: 'root.foos.1', foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo'}});

		const update = watcher.createUpdate(true);
		assert.deepEqual(update!.changes, {
			'foo': { gid: 'root.foo-2', name: 'RootFoo-2', foo: undefined, foos: [] },
			'foos': [
				{gid: 'root.foos.0'},
				{gid: 'root.foos.1', name: undefined, foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo', foo: undefined, foos: []}, foos: []}
			]
		});
	});
	it("records unaccepted update changes as changes in its new version", () => {
		class Foo extends Mozel {
			@string()
			foo?:string;
			@string()
			bar?:string;
		}
		const model1 = Foo.create<Foo>();
		const model2 = Foo.create<Foo>();
		const watcher1 = new MozelWatcher(model1, {priority: 1});
		const watcher2 = new MozelWatcher(model2);
		watcher1.start();
		watcher2.start();

		model1.foo = 'foo1';
		model2.foo = 'foo2';

		watcher1.createUpdate(true);
		const update2 = watcher2.createUpdate(true);

		assert.deepEqual(watcher1.changes, {}, "Watcher changes empty after created update.");

		watcher1.applyUpdate(update2!);
		assert.deepEqual(watcher1.changes, {
			'foo': 'foo1'
		}, "Watcher changes include override");

		const update = watcher1.createUpdate(true);
		assert.deepEqual(update!.changes, {
			'foo': 'foo1'
		}, "Watcher update includes override");
	});
	it("does not include updates identical to the ones already received", () => {
		class Foo extends Mozel {
			@string()
			name?:string;
			@number()
			number?:number;
			@property(Foo)
			foo?:Foo;
			@collection(Foo)
			foos!:Collection<Foo>;
		}
		const model1 = Foo.create<Foo>({gid: 'root'});
		const model2 = Foo.create<Foo>({gid: 'root'});
		const watcher1 = new MozelWatcher(model1, {priority: 1});
		const watcher2 = new MozelWatcher(model2);
		watcher1.start();
		watcher2.start();

		model1.name = 'Root-1';
		model1.$set('foo', {gid: 'root.foo', name: 'RootFoo-2'});
		model1.foos.set(0, {gid: 'root.foos.0'});

		const update1 = watcher1.createUpdate(true);
		watcher2.applyUpdate(update1!);

		assert.equal(model2.name, 'Root-1');
		assert.equal(model2.foos.get(0)!.gid, 'root.foos.0');

		model2.number = 2;
		model2.foo!.name = 'RootFoo-2';
		model2.foos.get(0)!.name = 'RootFoos0';

		const update2 = watcher2.createUpdate(true);

		assert.deepEqual(update2!.changes, {
			number: 2 // only the 'number' property is this MozelWatcher's responsibility
		});
	});
});
