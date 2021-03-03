import {assert} from 'chai';
import {describe, it} from 'mocha';
import Mozel, {Alphanumeric, alphanumeric, collection, injectableMozel, property, required,} from '../src/Mozel';
import Collection from '../src/Collection';

import {forEach, includes, uniq} from 'lodash';
import {Container, injectable} from "inversify";
import mozelContainer from "../src/inversify";
import MozelFactory from "../src/MozelFactory";
import {check, instanceOf} from "validation-kit";
import get = Reflect.get;

describe('Mozel', () => {
	describe(".export", () => {
		it('only returns properties defined with .defineProperty()', () => {
			class FooMozel extends Mozel {
				foo?:number;
				bar?:number;
				define() {
					super.define();
					this.defineProperty('foo');
				}
			}
			let mozel = new FooMozel();

			mozel.foo = 123;
			mozel.bar = 456;

			let exported = mozel.export();
			assert.deepInclude(exported, {foo: 123}, "Defined property 'foo' was exported with correct value");
			assert.notProperty(exported, 'bar', "Undefined property 'bar' was not exported");
		});
		it("generates an object that can be imported to reconstruct the same mozels", () => {
			class FooMozel extends Mozel {
				@property(String)
				foo?:string;
				@collection(Number)
				bar!:Collection<number>;
			}
			const foo = FooMozel.create<FooMozel>({
				foo: 'foo',
				bar: [1,2,3]
			});
			const reconstructed = FooMozel.create<FooMozel>(foo.export());
			assert.equal(reconstructed.foo, foo.foo);
			assert.deepEqual(reconstructed.bar, foo.bar);
		});
	});

	describe(".cloneDeep", () => {
		it("creates a new instance of the Mozel, with all nested properties having the same values.", () => {
			class Bar extends Mozel {
				@property(String)
				bar?:string;
			}
			class Foo extends Mozel {
				@property(Number, {required})
				foo!:number;

				@property(Foo)
				other?:Foo;

				@collection(Bar)
				bars!:Collection<Bar>
			}
			const foo = Foo.create<Foo>({
				foo:1,
				other:{foo:2},
				bars:[{bar:'a'},{bar:'b'}]
			});
			const clone = foo.cloneDeep<Foo>();
			assert.equal(foo.foo, clone.foo);
			assert.equal(get(foo, 'other.foo'), get(clone, 'other.foo'));
			const fooExport = foo.export();
			const cloneExport = clone.export();
			assert.deepEqual(fooExport, cloneExport);
		});
	});

	it('.defineProperty() with type argument creates setter that only accepts type-checked values or undefined and throws an error otherwise.', () => {
		// TS: Ignore mozel[property] access
		let mozel = <Mozel&{[key:string]:any}>new Mozel();
		mozel.defineProperty('foo', String);
		mozel.defineProperty('bar', Number);
		mozel.defineProperty('qux', Boolean);
		mozel.defineProperty('baz', Mozel);

		let obj = {}, arr:any[] = [], func = ()=>{}, otherMozel = new Mozel(), collection = new Collection(mozel, 'xyz', Mozel);
		const acceptable:{[key:string]:any[]} = {
			foo: ['abc', undefined],
			bar: [123, undefined],
			qux: [true, undefined],
			baz: [otherMozel, undefined]
		};
		const values = ['abc', 123, true, obj, arr, func, otherMozel, collection];
		const properties = ['foo', 'bar', 'qux'];

		// Try all values on all properties
		forEach(properties, property => {
			forEach(values, value => {
				let oldValue = mozel[property];
				try {
					mozel[property] = value;
				} catch (e) {
				}
				if (includes(acceptable[property], value)) {
					// For acceptable values, check if the new value was actually set.
					assert.equal(mozel[property], value, `${typeof (acceptable[property])} property ${property} accepted ${typeof (value)} input`);
				} else {
					// For unacceptable values, check if the new value was rejected.
					assert.notEqual(mozel[property], value, `${typeof (acceptable[property])} property ${property} did not accept ${typeof (value)} input`);
					assert.equal(mozel[property], oldValue, `${typeof (acceptable[property])} property value was maintained after rejection of ${typeof (value)} input rejection`);
				}
			});
		});
	});

	it('.defineProperty with without type argument creates setter that accepts only plain values or undefined.', () => {
		// TS: Ignore mozel[property] access
		let mozel = <Mozel&{[key:string]:any}>new Mozel();
		mozel.defineProperty('foo');

		let obj = {}, arr:any[] = [], func = ()=>{}, otherMozel = new Mozel(), collection = new Collection(mozel, 'xyz', Mozel);
		const acceptable:any[] = ['abc', 123, true, undefined];

		const values = ['abc', 123, true, obj, arr, func, otherMozel, collection];
		forEach(values, value => {
			let oldValue = mozel.foo;
			try {
				mozel.foo = value;
			} catch (e) {
			}
			if (includes(acceptable, value)) {
				// For acceptable values, check if the new value was actually set.
				assert.equal(mozel.foo, value, `${typeof(value)} value was accepted`);
			} else {
				// For unacceptable values, check if the new value was rejected.
				assert.notEqual(mozel.foo, value, `${typeof(value)} value was rejected`);
				assert.equal(mozel.foo, oldValue, `${typeof(value)} old value remained after rejection of new value`);
			}
		});
	});

	it('.create() initializes Mozel with properties from argument, based on properties defined in .defineData with .defineProperty().', () => {
		class FooMozel extends Mozel {
			define() {
				super.define();
				this.defineProperty('foo');
			}
		}

		// TS: Ignore mozel[property] access, use GenericMozel type to allow any data
		let foo = <{[key:string]:any}>FooMozel.create<any>({
			foo: 123,
			bar: 456
		});

		assert.equal(foo.foo, 123, "Defined proprety 'foo' set");
		assert.notProperty(foo, 'bar', "Undefined property 'bar' not set");
	});

	it('.create() data initialization recursively initializes sub-mozels.', ()=>{
		class BarMozel extends Mozel {
			define() {
				super.define();
				this.defineProperty('bar');
			}
		}
		class FooMozel extends Mozel {
			define() {
				super.define();
				this.defineProperty('foo', FooMozel);
				this.defineProperty('qux');
				this.defineCollection('bars', BarMozel);
			}
		}

		// TS: Ignore mozel[property] access, use GenericMozel to allow any input data
		let foo = <{[key:string]:any}>FooMozel.create<any>({
			foo: {
				qux: 123
			},
			bars: [
				{bar: 111},
				{bar: 222}
			]
		});

		assert.instanceOf(foo.foo, FooMozel, "Nested FooMozel was instantiated");
		assert.equal(foo.foo.qux, 123, "Nested FooMozel was initialized with 'qux' property value");
		assert.instanceOf(foo.bars, Collection, "'bars' collection was instantiated");
		assert.equal(foo.bars.toArray().length, 2, "'bars' collection has 2 items");
		assert.instanceOf(foo.bars.get(0), BarMozel, "First item in 'bars' collection is BarMozel");
		assert.instanceOf(foo.bars.get(1), BarMozel, "Second item in 'bar's");
		assert.equal(foo.bars.get(0).bar, 111, "First item in 'bars' collection was initialized with correct 'bar' property value");
		assert.equal(foo.bars.get(1).bar, 222, "Second item in 'bars' collection was initialized with correct 'bar' property value");
	});

	it("mozel properties and collections can be statically defined", () => {
		class FooMozel extends Mozel {}
		FooMozel.property('foo', String);
		FooMozel.collection('bar', Number);

		const mozel:any = FooMozel.create({foo: 'bar', bar: [1,2,3], qux: 123} as any);
		mozel.foo = 123;
		assert.equal(mozel.foo, 'bar', "Property set to correct value");
		assert.deepEqual(mozel.bar.list, [1,2,3], "Collection set");
		assert.notProperty(mozel, 'qux', "Non-existing property not set");
	});

	it('constructor using exported data from another object clones the exported object recursively.', () => {
		@injectable()
		class BarMozel extends Mozel {
			define() {
				super.define();
				this.defineProperty('qux');
			}
		}
		@injectable()
		class FooMozel extends Mozel {
			define() {
				super.define();
				this.defineCollection('bars', BarMozel);
			}
		}

		// TS: Ignore mozel[property] access
		let foo = <{[key:string]:any}>new FooMozel();
		let bar1 = <{[key:string]:any}>new BarMozel();
		let bar2 = <{[key:string]:any}>new BarMozel();

		bar1.qux = 123;
		bar2.qux = 456;

		foo.bars.add(bar1);
		foo.bars.add(bar2);

		let clone = <{[key:string]:any}>FooMozel.create(foo.export());

		assert.instanceOf(clone.bars, Collection, "Cloned instance has initialized 'bars' collection");
		assert.equal(clone.bars.length, 2, "'bars' collection of cloned instance has 2 items");
		assert.instanceOf(clone.bars.get(0), BarMozel, "First item in 'bars' collection is BarMozel");
		assert.instanceOf(clone.bars.get(1), BarMozel, "Second item in 'bar's");
		assert.equal(clone.bars.get(0).qux, 123, "First item in 'bars' collection was initialized with correct 'qux' property value");
		assert.equal(clone.bars.get(1).qux, 456, "Second item in 'bars' collection was initialized with correct 'qux' property value");
	});

	it('@property decorator defines Property based on the decorated property.', () => {
		class FooMozel extends Mozel {
			@property(String)
			foo?:String;
			@property(String)
			bar?:String;
			@property(FooMozel)
			qux?:FooMozel;
		}

		let mozel = <FooMozel>FooMozel.create<any>({
			foo: 'bar'
		});
		mozel.bar = 'foo';
		mozel.set('qux', {foo: 'abc'}, true);

		assert.equal(mozel.get('foo'),'bar', "Value for 'foo' correctly set correctly in create()");
		assert.equal(mozel.foo, 'bar', "Getter for 'foo' set correctly");
		assert.equal(mozel.get('bar'), 'foo', "Value for 'bar' set correctly using setter");
		assert.equal(mozel.qux && mozel.qux.foo, 'abc', "Mozel property initialized correctly using set()");
	});

	it('@collection decorator defines Property based on the decorated property.', () => {
		class FooMozel extends Mozel {
			@property(String)
			foo?:String;

			@collection(FooMozel)
			bar?:Collection<FooMozel>;
		}

		let foo = <FooMozel>FooMozel.create<any>({
			bar: [{foo:'abc'}]
		});

		let bar = foo.bar && foo.bar.get(0);
		assert.equal(bar && bar.foo, 'abc', "Collection 'bar' properly initialized");
	});

	it("constructor applies defaults for Properties recursively.", () => {
		class FooMozel extends Mozel {
			@property(String, {default: 'abc'})
			qux?:String;
		}
		class BarMozel extends Mozel {
			@property(FooMozel, {default: new FooMozel()})
			foo?:FooMozel;
			@property(Number, {default:123})
			xyz?:Number;
			@property(Number, {default: 789})
			baz?:Number;
			@collection(Number)
			abc!:Collection<number>
		}
		let bar = new BarMozel();
		bar.baz = 456;

		assert.equal(bar.xyz, 123, "Primitive default set correctly");
		assert.ok(bar.getProperty('xyz').isDefault(), "Primitive default is marked as default");
		assert.equal(bar.foo && bar.foo.qux, 'abc', "Nested mozel default set correctly");
		assert.ok(bar.foo && bar.foo.getProperty('qux').isDefault(), "Nested mozel marked as default");
		assert.equal(bar.baz, 456, "Preset value not overwritten by default.");
		assert.notOk(bar.getProperty('baz').isDefault(), "Overridden value not marked as default");
		assert.instanceOf(bar.abc, Collection, "Collections are instantiated by default");
	});

	it('cannot set required properties to null or undefined.', () => {
		class FooMozel extends Mozel {
			@property(String, {default:'abc', required:true})
			foo?:string|null; // setting incorrect type for test's sake
		}
		let mozel = new FooMozel();
		mozel.foo = 'xyz';
		assert.equal(mozel.foo, 'xyz', "String input accepted");
		mozel.foo = undefined;
		assert.equal(mozel.foo, 'xyz', "Undefined input not accepted");
		mozel.foo = null;
		assert.equal(mozel.foo, 'xyz', "Null input not accepted");
	});

	it('required Properties without defaults get generated default values', () => {
		class FooMozel extends Mozel {
			@property(String, {required:true})
			fooString!:string;
			@property(Number, {required:true})
			fooNumber!:number;
			@property(Boolean, {required:true})
			fooBoolean!:boolean;
			@property(Alphanumeric, {required:true})
			fooAlphanumeric!:alphanumeric;
			@property(Mozel, {required:true})
			fooMozel!:Mozel;
		}
		let mozel = new FooMozel();
		assert.equal(mozel.fooString, '', "String standard default set correctly");
		assert.equal(mozel.fooNumber, 0, "Numberic standard default set correctly");
		assert.equal(mozel.fooBoolean, false, "Boolean standard default set correctly");
		assert.equal(mozel.fooAlphanumeric, '', "Alphanumeric standard default set correctly");
		assert.instanceOf(mozel.fooMozel, Mozel, "Mozel standard default set correctly");
	});

	it('created with MozelFactory generates submozels based on _type property.', () => {
		let container = new Container({autoBindInjectable:true});
		container.parent = mozelContainer;

		const factory = new MozelFactory(container);

		@injectableMozel(container)
		class FooMozel extends Mozel {}

		@injectableMozel(container)
		class SubFooMozel extends FooMozel {}

		@injectableMozel(container)
		class BarMozel extends Mozel {
			@property(Mozel)
			foo?:Mozel;
			@collection(Mozel)
			foos!:Collection<Mozel>;
		}

		// Instantiate mozel
		const bar = factory.create(BarMozel, {
			foo: {_type:'FooMozel'},
			foos: [{_type:'FooMozel'}, {_type: 'SubFooMozel'}]
		});

		assert.instanceOf(bar.foo, FooMozel, "Created property submozel is of correct class");
		assert.instanceOf(bar.foos.get(0), FooMozel, "Created collection submozel is of correct class");
		assert.instanceOf(bar.foos.get(1), SubFooMozel, "Subclass was instantiated correctly")
	});
	it('function as default Property value is called to compute default.', () => {
		class FooMozel extends Mozel {
			@property(Number, {required, default: ()=>1+1})
			foo!:number;
		}

		const mozel = new FooMozel();
		assert.equal(mozel.foo, 2, "Default applied correctly");
	});

	it('created with MozelFactory gets assigned a unique GID if it does not already have one.', () => {
		const container = new Container({autoBindInjectable:true});

		@injectableMozel(container)
		class FooMozel extends Mozel {
			@property(FooMozel)
			foo?:FooMozel;
		}
		const factory = new MozelFactory(container);
		const mozel1 = factory.create<FooMozel>(FooMozel);
		const mozel2 = factory.create<FooMozel>(FooMozel, {
			foo: {}
		});
		const mozel3 = factory.create<FooMozel>(FooMozel, {
			gid: 'bar'
		});

		const fooGid = mozel2.foo && mozel2.foo.gid;
		const gids = [mozel1.gid, mozel2.gid, mozel3.gid, fooGid];

		assert.deepEqual(gids, uniq(gids), "All GIDs are unique");
		assert.equal(mozel3.gid, 'bar');
	});
	it('property can be a function.', ()=> {
		class FooMozel extends Mozel {
			@property(Function)
			foo?:()=>void;
		}
		let foo = new FooMozel();
		foo.foo = ()=>{};

		let expected = ()=>{};
		foo = FooMozel.create({
			foo:expected
		});
		assert.equal(foo.foo, expected);
	});
	it('notifies changes to watchers and deep watchers.', ()=>{
		class FooMozel extends Mozel {
			@property(FooMozel)
			foo?:FooMozel;

			@property(String)
			bar?:string;
		}

		const mozel = FooMozel.create<FooMozel>({
			foo: {
				foo: {
					bar: 'foobar'
				}
			}
		});

		let count = 0;
		mozel.watch({
			path: 'foo.foo.bar',
			handler: (newValue, oldValue) => {
				assert.equal(oldValue, 'foobar', "Old value was correct");
				assert.equal(newValue, 'barfoo', "New value was correct");
				count++;
			}
		});
		mozel.watch({
			path: 'foo.foo',
			handler: (newValue, oldValue) => {
				assert.equal((<FooMozel>oldValue).bar, 'foobar', "Old nested value was correct");
				assert.equal((<FooMozel>newValue).bar, 'barfoo', "New nested value was correct");
				count++;
			}
		})
		mozel.watch({
			path: 'bar',
		 	handler: ()=> {
				assert.ok(false, "Incorrect watched notified");
				count++;
			}
		});
		mozel.watch({
			path: 'foo',
			deep: true,
			handler: ()=> {
				assert.ok(true, "Deep watcher notified");
				count++;
			}
		});
		mozel.watch({
			path: 'bar',
			deep: true,
			handler: ()=>{
				assert.ok(false, "Incorrect deep watcher notified.");
				count++;
			}
		});

		if(!mozel.foo) return;
		mozel.foo.setData({foo: {bar: 'barfoo'}}, true);

		assert.equal(count, 3, "Correct number of handlers called");
	});
	it("notifies about changes to collections", () => {
		class Foo extends Mozel {
			@collection(Number)
			bars!:Collection<number>
		}
		const foo = Foo.create<Foo>({
			bars: [1,2,3]
		});

		let count = 0;
		foo.watch({
			path: 'bars',
			handler(newValue, oldValue) {
				const value = check<Collection<number>>(newValue, instanceOf(Collection), "Collection", "newValue");
				const old = check<Collection<number>>(oldValue, instanceOf(Collection), "Collection", "newValue");
				assert.deepEqual(value.toArray(), [4,5,6]);
				assert.deepEqual(old.toArray(), [1,2,3])
				count++;
			}
		})
		foo.setData({bars: [4,5,6]}, true);
		assert.equal(count, 1, "Correct number of watchers called.");
	});
	it("notifies about additions/removals to/from Collection ", () => {
		class Foo extends Mozel {
			@collection(Number)
			bars!:Collection<number>
		}
		const foo = Foo.create<Foo>({
			bars: [1,2,3]
		});

		let count = 0;
		foo.watch({
			path: 'bars',
			handler(newValue, oldValue) {
				const value = check<Collection<number>>(newValue, instanceOf(Collection), "Collection", "newValue");
				const old = check<Collection<number>>(oldValue, instanceOf(Collection), "Collection", "newValue");
				assert.deepEqual(value.toArray(), [1,2,3,4]);
				assert.deepEqual(old.toArray(), [1,2,3]);
				count++;
			},
			deep: true // is necessary to keep a clone of the old value
		})
		foo.bars.add(4);
		assert.equal(count, 1, "Correct number of watchers called.");
	});
	it("notifies about changes to any item in Collection ", () => {
		class Bar extends Mozel {
			@property(Number)
			bar?:number;
		}
		class Foo extends Mozel {
			@collection(Bar)
			bars!:Collection<Bar>
		}
		const foo = Foo.create<Foo>({
			bars: [{bar: 1},{bar: 2}]
		});

		let count = 0;
		foo.watch({
			path: 'bars',
			handler(newValue, oldValue) {
				const value = check<Collection<Bar>>(newValue, instanceOf(Collection), "Collection", "newValue");
				const old = check<Collection<Bar>>(oldValue, instanceOf(Collection), "Collection", "newValue");
				const newBar = value.get(1);
				const oldBar = old.get(1);
				assert.exists(newBar);
				assert.exists(oldBar);
				if(newBar && oldBar) {
					assert.equal(newBar.bar, 3);
					assert.equal(oldBar.bar, 2);
				}
				count++;
			},
			deep: true // is necessary to keep a clone of the old value
		});

		// Change item
		const bar = foo.bars.get(1);
		if(bar) bar.bar = 3;

		assert.equal(count, 1, "Correct number of watchers called.");
	});
});
