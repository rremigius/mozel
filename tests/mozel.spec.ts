import {assert} from 'chai';
import {describe, it} from 'mocha';
import Mozel, {
	Alphanumeric,
	alphanumeric,
	collection,
	property,
	required,
	schema,
	$s,
	deep,
	reference
} from '../src/Mozel';
import Collection from '../src/Collection';
import {forEach, get, includes, set} from 'lodash';
import {injectable} from "inversify";
import {check, instanceOf} from "validation-kit";

const VALUES = {
	string: 'abc',
	number: 123,
	object: {},
	boolean: true,
	array: [],
	function: ()=>{},
	mozel: new Mozel(),
	collection: (mozel:Mozel) => new Collection(mozel, 'foo', Mozel)
}
function checkAll(mozel:Mozel, acceptable:Record<string, any[]>) {
	const values = {...VALUES, collection: VALUES.collection(mozel)};

	const _mozel = <Mozel&{[key:string]:any}>mozel;
	// Try all values on all properties
	forEach(acceptable, (acceptable, property) => {
		forEach(values, value => {
			let oldValue = _mozel[property];
			try {
				_mozel[property] = value;
			} catch (e) {
			}
			if (includes(acceptable, value)) {
				// For acceptable values, check if the new value was actually set.
				assert.equal(_mozel[property], value, `${typeof (acceptable[0])} property '${property}' accepted ${typeof (value)} input`);
			} else {
				// For unacceptable values, check if the new value was rejected.
				assert.notEqual(_mozel[property], value, `${typeof (acceptable[0])} property '${property}' did not accept ${typeof (value)} input`);
				assert.equal(_mozel[property], oldValue, `${typeof (oldValue)} property value was maintained after rejection of ${typeof (value)} input`);
			}
		});
	});
}

describe('Mozel', () => {

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
	it('function as default Property value is called to compute default.', () => {
		class FooMozel extends Mozel {
			@property(Number, {required, default: ()=>1+1})
			foo!:number;
		}

		const mozel = new FooMozel();
		assert.equal(mozel.foo, 2, "Default applied correctly");
	});

	it("extending class inherits properties", () => {
		class FooMozel extends Mozel {
			@property(String, {required})
			foo?:string;
		}
		class BarMozel extends FooMozel {}

		const bar = BarMozel.create<BarMozel>({foo: 'bar'});
		assert.equal(bar.foo, 'bar');
	});

	describe("(static) create", () => {
		it('initializes Mozel with properties from argument, based on properties defined in .defineData with .defineProperty().', () => {
			class FooMozel extends Mozel {
				$define() {
					super.$define();
					this.$defineProperty('foo');
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
		it('data initialization recursively initializes sub-mozels.', ()=>{
			class BarMozel extends Mozel {
				$define() {
					super.$define();
					this.$defineProperty('bar');
				}
			}
			class FooMozel extends Mozel {
				$define() {
					super.$define();
					this.$defineProperty('foo', FooMozel);
					this.$defineProperty('qux');
					this.$defineCollection('bars', BarMozel);
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
		it('with exported data from another object clones the exported object recursively.', () => {
			@injectable()
			class BarMozel extends Mozel {
				$define() {
					super.$define();
					this.$defineProperty('qux');
				}
			}
			@injectable()
			class FooMozel extends Mozel {
				$define() {
					super.$define();
					this.$defineCollection('bars', BarMozel);
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

			let clone = <{[key:string]:any}>FooMozel.create(foo.$export());

			assert.instanceOf(clone.bars, Collection, "Cloned instance has initialized 'bars' collection");
			assert.equal(clone.bars.length, 2, "'bars' collection of cloned instance has 2 items");
			assert.instanceOf(clone.bars.get(0), BarMozel, "First item in 'bars' collection is BarMozel");
			assert.instanceOf(clone.bars.get(1), BarMozel, "Second item in 'bar's");
			assert.equal(clone.bars.get(0).qux, 123, "First item in 'bars' collection was initialized with correct 'qux' property value");
			assert.equal(clone.bars.get(1).qux, 456, "Second item in 'bars' collection was initialized with correct 'qux' property value");
		});
	});

	describe("(static) property", () => {
		it("can define property on class", () => {
			class FooMozel extends Mozel {}
			FooMozel.property('foo', String);

			const mozel:any = FooMozel.create({foo: 'bar', qux: 123});
			mozel.foo = 123;
			assert.equal(mozel.foo, 'bar', "Property set to correct value");
			assert.notProperty(mozel, 'qux', "Non-existing property not set");
		});
	});
	describe("(static collection)", () => {
		it("can define collection on class", () => {
			class FooMozel extends Mozel {}
			FooMozel.collection('foo', Number);

			const mozel:any = FooMozel.create({foo: [1,2,3]});
			assert.instanceOf(mozel.foo, Collection);
			assert.deepEqual(mozel.foo.toArray(), [1,2,3]);
		});
	});

	describe("@property", () => {
		it("defines a setter that only accepts type-checked values for the decorated property", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
				@property(Number)
				bar?:number;
				@property(Boolean)
				qux?:boolean;
				@property(Mozel)
				baz?:Mozel;
			}
			const foo = Foo.create<Foo>();
			checkAll(foo, {
				foo: [VALUES.string, undefined],
				bar: [VALUES.number, undefined],
				qux: [VALUES.boolean, undefined],
				baz: [VALUES.mozel, undefined]
			});
		});
	});
	describe("@collection", () => {
		it('defines Property based on the decorated property.', () => {
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
	});

	describe("constructor", () => {
		it("applies defaults for Properties recursively.", () => {
			class FooMozel extends Mozel {
				@property(String, {default: 'abc'})
				qux?:string;
			}
			class BarMozel extends Mozel {
				@property(FooMozel, {default: new FooMozel()})
				foo?:FooMozel;
				@property(Number, {default:123})
				xyz?:number;
				@property(Number, {default: 789})
				baz?:number;
				@collection(Number)
				abc!:Collection<number>
			}
			let bar = new BarMozel();
			bar.baz = 456;

			assert.equal(bar.xyz, 123, "Primitive default set correctly");
			assert.ok(bar.$property('xyz').isDefault(), "Primitive default is marked as default");
			assert.equal(bar.foo && bar.foo.qux, 'abc', "Nested mozel default set correctly");
			assert.ok(bar.foo && bar.foo.$property('qux').isDefault(), "Nested mozel marked as default");
			assert.equal(bar.baz, 456, "Preset value not overwritten by default.");
			assert.notOk(bar.$property('baz').isDefault(), "Overridden value not marked as default");
			assert.instanceOf(bar.abc, Collection, "Collections are instantiated by default");
		});
		it('generates default values for required Properties without defaults', () => {
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
	});

	describe("$export", () => {
		it('only returns properties defined with $defineProperty, @property or Mozel.property', () => {
			class FooMozel extends Mozel {
				@property()
				prop1?:number;
				prop2?:number;
				noprop?:number;
				$define() {
					super.$define();
					this.$defineProperty('prop2');
				}
			}
			FooMozel.property('prop3');
			let mozel = new FooMozel();

			mozel.prop1 = 1;
			mozel.prop2 = 1;
			mozel.noprop = 1;

			let exported = mozel.$export();
			assert.deepInclude(exported, {prop1: 1}, "Defined property 'prop1' was exported with correct value");
			assert.deepInclude(exported, {prop2: 1}, "Defined property 'prop2' was exported with correct value");
			assert.notProperty(exported, 'noprop', "Undefined property 'noprop' was not exported");
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
			const reconstructed = FooMozel.create<FooMozel>(foo.$export());
			assert.equal(reconstructed.foo, foo.foo);
			assert.deepEqual(reconstructed.bar.toArray(), foo.bar.toArray());
		});
	});

	describe("$defineProperty", () => {
		it("with type argument creates setter that only accepts type-checked values or undefined and throws an error otherwise.", () => {
			// TS: Ignore mozel[property] access
			let mozel = <Mozel&{[key:string]:any}>new Mozel();
			mozel.$defineProperty('foo', String);
			mozel.$defineProperty('bar', Number);
			mozel.$defineProperty('qux', Boolean);
			mozel.$defineProperty('baz', Mozel);

			const acceptable = {
				foo: [VALUES.string, undefined],
				bar: [VALUES.number, undefined],
				qux: [VALUES.boolean, undefined],
				baz: [VALUES.mozel, undefined]
			};

			checkAll(mozel, acceptable);
		});
		it('without type argument creates setter that accepts only primitive values or undefined.', () => {
			// TS: Ignore mozel[property] access
			let mozel = <Mozel&{[key:string]:any}>new Mozel();
			mozel.$defineProperty('foo');

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
	});
	describe("$pathPattern", () => {
		it("returns all values at paths matching the given pattern", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(Foo)
				foo?:Foo;
				@property(Foo)
				bar?:Foo;
			}
			const foo = Foo.create<Foo>({
				foo: {
					name: 'foo',
					foo: {
						name: 'foofoo'
					},
					bar: {
						name: 'foobar'
					}
				}
			});
			assert.deepEqual(foo.$pathPattern("foo.*.name"), {
				"foo.foo.name": "foofoo",
				"foo.bar.name": "foobar"
			});
		});
		it("returns all values at matching paths including collections", ()=> {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@collection(Foo)
				foos!:Collection<Foo>;
			}
			const foo = Foo.create<Foo>({
				foos: [
					{name: 'foo1'},
					{name: 'foo2'},
					{name: 'foo3'}
				]
			});
			assert.deepEqual(foo.$pathPattern('foos.*.name'), {
				"foos.0.name": 'foo1',
				"foos.1.name": 'foo2',
				"foos.2.name": 'foo3'
			});
		});
	});
	describe("$watchers", () => {
		it("returns all watchers matching the given path", () => {
			const mozel = new Mozel();
			const mozelWatch = mozel.$watch('', ()=>{}, {deep:true});
			const fooDeep = mozel.$watch('foo', ()=>{},{deep: true});
			const fooShallow = mozel.$watch('foo', ()=>{});
			const foobar = mozel.$watch('foo.bar', ()=>{});
			const foobarqux = mozel.$watch('foo.bar.qux', ()=>{});
			const baz = mozel.$watch('baz', ()=>{});
			const bazbar = mozel.$watch('baz.bar', ()=>{});

			const watchers = mozel.$watchers('foo.bar');
			assert.deepEqual(watchers, [mozelWatch, fooDeep, foobar, foobarqux]);
		});
	});
	describe("$watch", () => {
		class Foo extends Mozel {
			@property(Foo)
			foo?:Foo;

			@property(String)
			bar?:string;
		}
		it('notifies changes to path', ()=>{
			const mozel = Foo.create<Foo>({
				foo: {
					bar: 'foobar'
				}
			});

			let count = 0;
			mozel.$watch('foo.bar', ({newValue, oldValue}) => {
				assert.equal(oldValue, 'foobar', "Old value was correct");
				assert.equal(newValue, 'barfoo', "New value was correct");
				count++;
			});
			mozel.$watch('foo.foo', ()=>{
				assert.ok(false, "Incorrect deep watcher notified.");
				count++;
			});
			set(mozel, 'foo.bar', 'barfoo');
			assert.equal(count, 1, "Correct number of callbacks");
		});
		it("with `deep:true` notifies changes to child of path", () => {
			let count = 0;
			const mozel = Foo.create<Foo>({
				foo: {
					bar: 'foobar'
				}
			});
			mozel.$watch('foo', ()=> {
				assert.ok(true, "Deep watcher notified");
				count++;
			}, {
				deep: true
			});
			mozel.$watch('bar', ()=>{
				assert.ok(false, "Incorrect deep watcher notified.");
				count++;
			}, {
				deep: true
			});

			set(mozel, 'foo.bar', 'barfoo');
			assert.equal(count, 1, "Correct number of callbacks");
		});
		it("notifies about new values when parent is replaced", () => {
			const root = Foo.create<Foo>({
				bar: "a",
				foo: {
					bar: "b",
					foo: { bar: "c" }
				}
			});

			let count = 0;
			root.$watch('foo.foo.bar',({newValue, oldValue}) => {
				assert.equal(newValue, "x");
				assert.equal(oldValue, "c");
				count++;
			});
			root.foo = Foo.create<Foo>({
				foo: {
					bar: "x"
				}
			});
			assert.equal(count, 1, "Correct number of callbacks made.");
		});
		it("with wildcard path notifies about changes to each of the matching paths", () => {
			class Tree extends Mozel {
				@property(String)
				name!:string;
				@property(Tree)
				left?:Tree;
				@property(Tree)
				right?:Tree;
			}
			const tree = Tree.create<Tree>({
				name: 'root',
				left: {
					name: 'l',
					left: {
						name: 'll',
					},
					right: {
						name: 'lr'
					}
				}
			});
			tree.$watch('left.*.name', ({newValue, oldValue, valuePath}) => {
				if(valuePath === 'left.left.name') {
					assert.equal(newValue, 'll2');
				} else if (valuePath == 'left.right.name') {
					assert.equal(newValue, 'lr2');
				} else {
					assert.ok(false, "oldValue");
				}
			});
			tree.left = Tree.create<Tree>({
				left: {
					name: 'll2'
				},
				right: {
					name: 'lr2'
				}
			});
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
			const oldValues:number[][] = [];
			const newValues:number[][] = [];
			foo.$watch('bars', ({newValue, oldValue}) => {
				const value = check<Collection<number>>(newValue, instanceOf(Collection), "Collection", "newValue");
				const old = check<Collection<number>>(oldValue, instanceOf(Collection), "Collection", "oldValue");
				newValues.push(value.toArray());
				oldValues.push(old.toArray());
				count++;
			}, { deep });
			foo.bars.setData([4,5,6]);
			assert.equal(count, 3, "Correct number of watchers called.");
			assert.deepEqual(newValues, [
				[4,2,3], [4,5,3], [4,5,6]
			], "new values in watchers correct");
			assert.deepEqual(oldValues, [
				[1,2,3], [4,2,3], [4,5,3]
			], "old values in watchers correct");
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
			foo.$watch('bars',
			({newValue, oldValue}) => {
				const value = check<Collection<number>>(newValue, instanceOf(Collection), "Collection", "newValue");
				const old = check<Collection<number>>(oldValue, instanceOf(Collection), "Collection", "newValue");
				assert.deepEqual(value.toArray(), [1,2,3,4]);
				assert.deepEqual(old.toArray(), [1,2,3]);
				count++;
			}, {
				deep: true // is necessary to keep a clone of the old value
			});
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
			foo.$watch('bars', ({newValue, oldValue}) => {
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
			}, {
				deep: true // is necessary to keep a clone of the old value
			});
			foo.$watch('bars.1.bar', ({newValue, oldValue, valuePath}) => {
				assert.equal(valuePath, 'bars.1.bar');
				assert.equal(newValue, 3);
				assert.equal(oldValue, 2);
				count++;
			});

			// Change item
			const bar = foo.bars.get(1);
			if(bar) bar.bar = 3;

			assert.equal(count, 2, "Correct number of watchers called.");
		});
		it("with schema provides typescript checking for handler", () => {
			class Foo extends Mozel {
				@property(Number, {required})
				foo!:number;
			}
			let count = 0;
			const foo = new Foo();
			foo.$watch(schema(Foo).foo, ({newValue}) => {
				assert.ok(newValue === 1);
				count++;
			});
			foo.foo = 1;
			assert.equal(count, 1, "Correct number of watchers called.");
		});
		it("does not trigger handler for collection even if provided with new array", () => {
			class Foo extends Mozel {
				@collection(Foo)
				foos!:Collection<Foo>;
			}
			const foo = Foo.create<Foo>();
			const bar = Foo.create<Foo>();

			let count = 0;
			foo.$watch(schema(Foo).foos, ({newValue, oldValue}) => {
				assert.notEqual(newValue, oldValue);
				count++;
			});
			foo.foos.add(bar);
			assert.equal(count, 0, "Watcher not fired after addition.");
			foo.$set('foos', [bar]);
			assert.equal(count, 0, "Watcher not fired after replacement.");
		});
		it("with `debounce` limits the calls to the handler", () => {
			class Foo extends Mozel {
				@property(String) name?:string;
				@property(Foo) foo?:Foo;
			}
			const foo = Foo.create<Foo>({
				name: 'a',
				foo: {
					name: 'b',
					foo: {name: 'c'}
				}
			});
			let count = 0;
			foo.$watch('foo', () => {
				count++;
			}, {deep, debounce: {leading: true}});

			foo!.foo!.name = 'bx';
			foo!.foo!.foo!.name = 'cx';

			assert.equal(count, 1, "Watched called exactly once.");
		});
	});
	describe("$strict = false", () => {
		class Foo extends Mozel {
			@property(String)
			name?:string;
			@property(Foo)
			foo?:Foo
			@collection(Foo)
			foos!:Collection<Foo>;
		}
		// TS: setting as `any` because we'll make it not-strict
		const mozel = <any>Foo.create<Foo>({
			name: 'foo',
			foo: {
				name: 'foofoo'
			},
			foos: [{name:'foos1'}, {name: 'foos2'}]
		});
		mozel.$strict = false;
		mozel.name = 123;
		mozel.foo.foo = 'nofoo';
		mozel.foos.setData([1, {name: 'foos3'}], true);

		it("disables rejection of mismatching values", () => {
			assert.equal(mozel.name, 123);
			assert.equal(mozel.foo.foo, 'nofoo');
		});
		it("provides errors for invalid values on the properties", () => {
			assert.instanceOf(mozel.$property('name').error, Error);
			assert.equal(mozel.foo.$property('name').error, undefined);
		});
		it("errors can be retrieved using $errors()", () => {
			assert.instanceOf(mozel.foo.$errors.foo, Error);
			assert.deepEqual(Object.keys(mozel.foo.$errors), ['foo']);
			assert.deepEqual(Object.keys(mozel.foos.$errors), ['0']);
			assert.instanceOf(mozel.foos.$errors['0'], Error);
		});
		it("all errors can be retrieved recursively using $errors(true)", () => {
			const deepErrors = mozel.$errorsDeep();
			assert.instanceOf(deepErrors['name'], Error);
			assert.instanceOf(deepErrors['foos.0'], Error);
			assert.instanceOf(deepErrors['foo.foo'], Error);

		});
	});
	describe("$setParent", () => {
		it("disconnects the Mozel from its current parent", () => {
			class Foo extends Mozel {
				@property(String, {required})
				name!:string;
				@property(Foo)
				foo?:Foo;
			}
			const subfoo = Foo.create<Foo>();
			const foo1 = Foo.create<Foo>({
				foo: subfoo
			});
			const foo2 = Foo.create<Foo>();

			assert.equal(foo1.foo, subfoo, "Foo1 has subfoo");
			assert.equal(foo2.foo, undefined, "No subfoo set on foo2");

			foo2.foo = foo1.foo; // Assign subfoo to new parent

			assert.equal(foo1.foo, undefined, 'No subfoo set on foo1 after tranfer');
			assert.equal(foo2.foo, subfoo, "Foo2 has subfoo");
		});
	});
	describe("$schema/$", () => {
		it("provides a path for each step down the hierarchy", () => {
			class Tree extends Mozel {
				@property(Tree)
				left?:Tree;
				@property(Tree)
				right?:Tree;
				@collection(Tree)
				branches!:Collection<Tree>;
			}

			assert.equal(Tree.$schema<Tree>().left.$path, 'left');
			assert.equal(Tree.$<Tree>().right.left.right.$, 'right.left.right');
			assert.equal(Tree.$<Tree>().right.left.$type, Tree);
			assert.equal(Tree.$<Tree>().branches.left.right.$, 'branches.left.right');
			assert.equal(Tree.$<Tree>().branches.$type, Tree);
			assert.equal(Tree.$<Tree>().branches.$collection, true);
			assert.equal(schema(Tree).branches.left.right.$, 'branches.left.right');
			assert.equal($s(Tree).branches.left.right.$, 'branches.left.right');
		});
		it("includes properties belonging to parent classes", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			class Bar extends Foo {

			}
			assert.equal(schema(Bar).foo.$, 'foo');
		});
	});
	describe("$forEachChild", () => {
		it("calls the given function for each of the child mozels", () => {
			class Foo extends Mozel {
				@property(Foo)
				oneFoo?:Foo;

				@collection(Foo)
				manyFoos!:Collection<Foo>;
			}

			const foo = Foo.create<Foo>({
				gid: 1,
				oneFoo: {gid: 11},
				manyFoos: [{gid: 121}, {gid: 122}]
			});

			const gids:alphanumeric[] = [];
			foo.$forEachChild(mozel => gids.push(mozel.gid));
			assert.deepEqual(gids, [11, 121, 122]);
		});
	});
	describe("$setData", () => {
		it("sets all properties, including undefined", () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
				@property(String)
				bar?:string;
				@property(Foo)
				other?:Foo;
			}
			const foo = Foo.create<Foo>({
				gid: 'foo',
				foo: 'foo.foo',
				bar: 'foo.bar',
				other: {
					gid: 'foo.other',
					foo: 'foo.other.foo',
					bar: 'foo.other.bar',
					other: {gid: 'foo.other.other'}
				}
			});
			foo.$setData({
				gid: 'foo',
				foo: 'FOO.FOO',
				other: {
					gid: 'foo.other',
					bar: 'FOO.OTHER.BAR'
				}
			});
			assert.equal(foo.foo, "FOO.FOO", "'foo.foo' changed");
			assert.equal(foo.bar, undefined, "'foo.bar' unset");
			assert.equal(foo.other!.bar, "FOO.OTHER.BAR", "'foo.other.bar' changed");
			assert.equal(foo.other!.other, undefined, "'foo.other.other' unset");
		});

		it("leaves Mozels in place if possible, just setting its data", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(Foo)
				other?:Foo;
				@collection(Foo)
				foos?:Collection<Foo>;
				@property(Foo, {reference})
				ref?:Foo;
			}
			const root = Foo.create<Foo>({
				gid: 'root',
				name: 'root',
				other: {
					gid: 'root.other',
					name: 'A'
				},
				foos: [
					{gid: 'root.foos.1'}, {gid: 'root.foos.2'}
				],
				ref: {gid: 'root.other'}
			});
			const rootOther = root.other;
			const rootFoos1 = root.foos!.get(0);
			const rootFoos2 = root.foos!.get(1);
			const rootRef = root.ref;

			const changes:string[] = [];
			root.$watch('*', event => {
				changes.push(event.changePath);
			}, {deep});

			root.$setData({
				gid: 'root',
				name: 'root',
				other: {
					gid: 'root.other',
					name: 'B'
				},
				foos: [
					{gid: 'root.foos.1A'}, {gid: 'root.foos.2', name: 'C'}, {gid: 'root.foos.3'}
				],
				ref: {gid: 'root.other'}
			});

			const newRootOther = root.other;
			const newRootFoos1 = root.foos!.get(0);
			const newRootFoos2 = root.foos!.get(1);
			const newRootRef = root.ref;

			assert.equal(newRootOther, rootOther, "root.other");
			assert.notEqual(newRootFoos1, rootFoos1, "root.foos.1");
			assert.equal(newRootFoos2, rootFoos2, "root.foos.2");
			assert.equal(newRootRef, rootRef, "root.ref");
			assert.deepEqual(changes, [
				'other.name',
				'foos.0',
				'foos.1.name',
				'foos.2'
			]);
		});

		it("with merge = true sets only defined keys and ignores existing values and keeps current mozels if possible", () => {
			class Foo extends Mozel {
				@property(String)
				name?:string;
				@property(String)
				extra?:string;
				@property(Foo)
				other?:Foo;
				@collection(Foo)
				list?:Collection<Foo>
				@property(Foo, {reference})
				ref?:Foo;
			}
			const factory = Foo.createFactory();
			const root = factory.createAndResolveReferences(Foo, {
				name: 'root',
				extra: 'ROOT_EXTRA',
				other: {gid: 'root.other', name: 'root.other', extra: 'ROOT_OTHER_EXTRA'},
				list: [{name: 'root.list.0', extra: 'ROOT_LIST_0_EXTRA'}, {name: 'root.list.1'}, {name: 'root.list.2'}],
				ref: {gid: 'root.other'}
			});
			const rootOther = root.other;
			const rootList0 = root.list!.get(0);
			const rootList1 = root.list!.get(1);
			const rootList2 = root.list!.get(2);
			const rootList1Other = rootList1!.other;

			root.$setData({
				name: 'root2',
				other: {name: 'root.other2'},
				list: [{extra: 'ROOT_LIST_0_NEW_EXTRA'}, {other: {name: 'root.list.1.other'}}, {gid: 'NEW_ITEM'}],
				ref: {}
			}, true);

			const newRootOther = root.other;
			const newRootList0 = root.list!.get(0);
			const newRootList1 = root.list!.get(1);
			const newRootList2 = root.list!.get(2);
			const newRootList1Other = newRootList1!.other;

			assert.equal(root.name, 'root2', "Direct property set");
			assert.equal(root.extra, 'ROOT_EXTRA', "Undefined direct property untouched");
			assert.equal(newRootOther, rootOther, "'other' untouched");
			assert.equal(newRootOther!.name, 'root.other2', "'other' property changed");
			assert.equal(newRootList0, rootList0, "'root.list.0' untouched.");
			assert.notEqual(newRootList1Other, rootList1Other, "'root.list.1.other' changed");
			assert.notEqual(newRootList2, rootList2, "'root.list.2' replaced");
		});
	});
});
