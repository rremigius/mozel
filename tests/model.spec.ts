import {assert} from 'chai';
import {describe,it} from 'mocha';
import Model, {Alphanumeric, collection, Data, injectableModel, ModelData, property,} from '@/Model';
import Collection from '@/Collection';

import {forEach, includes, uniq} from 'lodash';
import {Container, injectable} from "inversify";
import modelContainer from "@/inversify";
import {reference, required, alphanumeric} from "@/Model";
import ModelFactory from "@/ModelFactory";
import GenericModel from "../src/GenericModel";

describe('Model', () => {
	it('.export() only returns properties defined with .defineProperty()', () => {
		class FooModel extends Model {
			foo?:number;
			bar?:number;
			defineData() {
				super.defineData();
				this.defineProperty('foo');
			}
		}
		let model = new FooModel();

		model.foo = 123;
		model.bar = 456;

		let exported = model.export();
		assert.deepInclude(exported, {foo: 123}, "Defined property 'foo' was exported with correct value");
		assert.notProperty(exported, 'bar', "Undefined property 'bar' was not exported");
	});

	it('.defineProperty() with type argument creates setter that only accepts type-checked values or undefined and throws an error otherwise.', () => {
		// TS: Ignore model[property] access
		let model = <Model&{[key:string]:any}>new Model();
		model.defineProperty('foo', String);
		model.defineProperty('bar', Number);
		model.defineProperty('qux', Boolean);
		model.defineProperty('baz', Model);

		let obj = {}, arr:any[] = [], func = ()=>{}, otherModel = new Model(), collection = new Collection(model, 'xyz', Model);
		const acceptable:{[key:string]:any[]} = {
			foo: ['abc', undefined],
			bar: [123, undefined],
			qux: [true, undefined],
			baz: [otherModel, undefined]
		};
		const values = ['abc', 123, true, obj, arr, func, otherModel, collection];
		const properties = ['foo', 'bar', 'qux'];

		// Try all values on all properties
		forEach(properties, property => {
			forEach(values, value => {
				let oldValue = model[property];
				try {
					model[property] = value;
				} catch (e) {
				}
				if (includes(acceptable[property], value)) {
					// For acceptable values, check if the new value was actually set.
					assert.equal(model[property], value, `${typeof (acceptable[property])} property ${property} accepted ${typeof (value)} input`);
				} else {
					// For unacceptable values, check if the new value was rejected.
					assert.notEqual(model[property], value, `${typeof (acceptable[property])} property ${property} did not accept ${typeof (value)} input`);
					assert.equal(model[property], oldValue, `${typeof (acceptable[property])} property value was maintained after rejection of ${typeof (value)} input rejection`);
				}
			});
		});
	});

	it('.defineProperty with without type argument creates setter that accepts only plain values or undefined.', () => {
		// TS: Ignore model[property] access
		let model = <Model&{[key:string]:any}>new Model();
		model.defineProperty('foo');

		let obj = {}, arr:any[] = [], func = ()=>{}, otherModel = new Model(), collection = new Collection(model, 'xyz', Model);
		const acceptable:any[] = ['abc', 123, true, undefined];

		const values = ['abc', 123, true, obj, arr, func, otherModel, collection];
		forEach(values, value => {
			let oldValue = model.foo;
			try {
				model.foo = value;
			} catch (e) {
			}
			if (includes(acceptable, value)) {
				// For acceptable values, check if the new value was actually set.
				assert.equal(model.foo, value, `${typeof(value)} value was accepted`);
			} else {
				// For unacceptable values, check if the new value was rejected.
				assert.notEqual(model.foo, value, `${typeof(value)} value was rejected`);
				assert.equal(model.foo, oldValue, `${typeof(value)} old value remained after rejection of new value`);
			}
		});
	});

	it('.create() initializes Model with properties from argument, based on properties defined in .defineData with .defineProperty().', () => {
		class FooModel extends Model {
			defineData() {
				super.defineData();
				this.defineProperty('foo');
			}
		}

		// TS: Ignore model[property] access, use GenericModel type to allow any data
		let foo = <{[key:string]:any}>FooModel.create<any>({
			foo: 123,
			bar: 456
		});

		assert.equal(foo.foo, 123, "Defined proprety 'foo' set");
		assert.notProperty(foo, 'bar', "Undefined property 'bar' not set");
	});

	it('.create() data initialization recursively initializes sub-models.', ()=>{
		class BarModel extends Model {
			defineData() {
				super.defineData();
				this.defineProperty('bar');
			}
		}
		class FooModel extends Model {
			defineData() {
				super.defineData();
				this.defineProperty('foo', FooModel);
				this.defineProperty('qux');
				this.defineCollection('bars', BarModel);
			}
		}

		// TS: Ignore model[property] access, use GenericModel to allow any input data
		let foo = <{[key:string]:any}>FooModel.create<any>({
			foo: {
				qux: 123
			},
			bars: [
				{bar: 111},
				{bar: 222}
			]
		});

		assert.instanceOf(foo.foo, FooModel, "Nested FooModel was instantiated");
		assert.equal(foo.foo.qux, 123, "Nested FooModel was initialized with 'qux' property value");
		assert.instanceOf(foo.bars, Collection, "'bars' collection was instantiated");
		assert.equal(foo.bars.toArray().length, 2, "'bars' collection has 2 items");
		assert.instanceOf(foo.bars.get(0), BarModel, "First item in 'bars' collection is BarModel");
		assert.instanceOf(foo.bars.get(1), BarModel, "Second item in 'bar's");
		assert.equal(foo.bars.get(0).bar, 111, "First item in 'bars' collection was initialized with correct 'bar' property value");
		assert.equal(foo.bars.get(1).bar, 222, "Second item in 'bars' collection was initialized with correct 'bar' property value");
	});

	it('constructor using exported data from another object clones the exported object recursively.', () => {
		@injectable()
		class BarModel extends Model {
			defineData() {
				super.defineData();
				this.defineProperty('qux');
			}
		}
		@injectable()
		class FooModel extends Model {
			defineData() {
				super.defineData();
				this.defineCollection('bars', BarModel);
			}
		}

		// TS: Ignore model[property] access
		let foo = <{[key:string]:any}>new FooModel();
		let bar1 = <{[key:string]:any}>new BarModel();
		let bar2 = <{[key:string]:any}>new BarModel();

		bar1.qux = 123;
		bar2.qux = 456;

		foo.bars.add(bar1);
		foo.bars.add(bar2);

		let clone = <{[key:string]:any}>FooModel.create(foo.export());

		assert.instanceOf(clone.bars, Collection, "Cloned instance has initialized 'bars' collection");
		assert.equal(clone.bars.length, 2, "'bars' collection of cloned instance has 2 items");
		assert.instanceOf(clone.bars.get(0), BarModel, "First item in 'bars' collection is BarModel");
		assert.instanceOf(clone.bars.get(1), BarModel, "Second item in 'bar's");
		assert.equal(clone.bars.get(0).qux, 123, "First item in 'bars' collection was initialized with correct 'qux' property value");
		assert.equal(clone.bars.get(1).qux, 456, "Second item in 'bars' collection was initialized with correct 'qux' property value");
	});

	it('@property decorator defines Property based on the decorated property.', () => {
		class FooModel extends Model {
			@property(String)
			foo?:String;
			@property(String)
			bar?:String;
			@property(FooModel)
			qux?:FooModel;
		}

		let model = <FooModel>FooModel.create<any>({
			foo: 'bar'
		});
		model.bar = 'foo';
		model.set('qux', {foo: 'abc'}, true);

		assert.equal(model.get('foo'),'bar', "Value for 'foo' correctly set correctly in create()");
		assert.equal(model.foo, 'bar', "Getter for 'foo' set correctly");
		assert.equal(model.get('bar'), 'foo', "Value for 'bar' set correctly using setter");
		assert.equal(model.qux && model.qux.foo, 'abc', "Model property initialized correctly using set()");
	});

	it('@collection decorator defines Property based on the decorated property.', () => {
		class FooModel extends Model {
			@property(String)
			foo?:String;

			@collection(FooModel)
			bar?:Collection<FooModel>;
		}

		let foo = <FooModel>FooModel.create<any>({
			bar: [{foo:'abc'}]
		});

		let bar = foo.bar && foo.bar.get(0);
		assert.equal(bar && bar.foo, 'abc', "Collection 'bar' properly initialized");
	});

	it("constructor applies defaults for Properties recursively.", () => {
		class FooModel extends Model {
			@property(String, {default: 'abc'})
			qux?:String;
		}
		class BarModel extends Model {
			@property(FooModel, {default: new FooModel()})
			foo?:FooModel;
			@property(Number, {default:123})
			xyz?:Number;
			@property(Number, {default: 789})
			baz?:Number;
			@collection(Number)
			abc!:Collection<number>
		}
		let bar = new BarModel();
		bar.baz = 456;

		assert.equal(bar.xyz, 123, "Primitive default set correctly");
		assert.ok(bar.getProperty('xyz').isDefault(), "Primitive default is marked as default");
		assert.equal(bar.foo && bar.foo.qux, 'abc', "Nested model default set correctly");
		assert.ok(bar.foo && bar.foo.getProperty('qux').isDefault(), "Nested model marked as default");
		assert.equal(bar.baz, 456, "Preset value not overwritten by default.");
		assert.notOk(bar.getProperty('baz').isDefault(), "Overridden value not marked as default");
		assert.instanceOf(bar.abc, Collection, "Collections are instantiated by default");
	});

	it('cannot set required properties to null or undefined.', () => {
		class FooModel extends Model {
			@property(String, {default:'abc', required:true})
			foo?:string|null; // setting incorrect type for test's sake
		}
		let model = new FooModel();
		model.foo = 'xyz';
		assert.equal(model.foo, 'xyz', "String input accepted");
		model.foo = undefined;
		assert.equal(model.foo, 'xyz', "Undefined input not accepted");
		model.foo = null;
		assert.equal(model.foo, 'xyz', "Null input not accepted");
	});

	it('required Properties without defaults get generated default values', () => {
		class FooModel extends Model {
			@property(String, {required:true})
			fooString!:string;
			@property(Number, {required:true})
			fooNumber!:number;
			@property(Boolean, {required:true})
			fooBoolean!:boolean;
			@property(Alphanumeric, {required:true})
			fooAlphanumeric!:alphanumeric;
			@property(Model, {required:true})
			fooModel!:Model;
		}
		let model = new FooModel();
		assert.equal(model.fooString, '', "String standard default set correctly");
		assert.equal(model.fooNumber, 0, "Numberic standard default set correctly");
		assert.equal(model.fooBoolean, false, "Boolean standard default set correctly");
		assert.equal(model.fooAlphanumeric, '', "Alphanumeric standard default set correctly");
		assert.instanceOf(model.fooModel, Model, "Model standard default set correctly");
	});

	it('created with ModelFactory generates submodels based on _type property.', () => {
		let container = new Container({autoBindInjectable:true});
		container.parent = modelContainer;

		const factory = new ModelFactory(container);

		@injectableModel(container)
		class FooModel extends Model {
			static get type() { return 'FooModel'; };
		}

		@injectable()
		class BarModel extends Model {
			@property(Model)
			foo?:Model;
			@collection(Model)
			foos!:Collection<Model>;
		}

		// Instantiate model
		const bar = factory.create<BarModel>(BarModel, {
			foo: {_type:'FooModel'},
			foos: [{_type:'FooModel'}]
		});

		assert.instanceOf(bar.foo, FooModel, "Created property submodel is of correct class");
		assert.instanceOf(bar.foos.get(0), FooModel, "Created collection submodel is of correct class");
	});
	it('function as default Property value is called to compute default.', () => {
		class FooModel extends Model {
			@property(Number, {required, default: ()=>1+1})
			foo!:number;
		}

		const model = new FooModel();
		assert.equal(model.foo, 2, "Default applied correctly");
	});

	it('created with ModelFactory gets assigned a unique GID if it does not already have one.', () => {
		const container = new Container({autoBindInjectable:true});

		@injectableModel(container)
		class FooModel extends Model {
			@property(FooModel)
			foo?:FooModel;
		}
		const factory = new ModelFactory(container);
		const model1 = factory.create<FooModel>(FooModel);
		const model2 = factory.create<FooModel>(FooModel, {
			foo: {}
		});
		const model3 = factory.create<FooModel>(FooModel, {
			gid: 'bar'
		});

		const fooGid = model2.foo && model2.foo.gid;
		const gids = [model1.gid, model2.gid, model3.gid, fooGid];

		assert.deepEqual(gids, uniq(gids), "All GIDs are unique");
		assert.equal(model3.gid, 'bar');
	});
	it('created with ModelFactory resolves reference Properties from Registry.', ()=> {
		const container = new Container({autoBindInjectable:true});

		@injectableModel(container)
		class FooModel extends Model {
			@collection(FooModel)
			fooChildren!:Collection<FooModel>;
			@property(FooModel, {reference})
			fooReference?:FooModel;
			@collection(FooModel, {reference})
			fooReferences!:Collection<FooModel>;
		}
		const factory = new ModelFactory(container);
		const foo = factory.create<FooModel>(FooModel, {
			gid: 1,
			fooChildren: [
				{ gid: 11 },
				{ gid: 12 },
				{ gid: 13 },
				{
					gid: 14,
					fooReference: { gid: 11 },
					fooReferences: [ { gid: 12 }, { gid: 13 } ]
				}
			]
		}, true);

		const child1 = foo.fooChildren.get(0);
		const child2 = foo.fooChildren.get(1);
		const child3 = foo.fooChildren.get(2);
		const lastChild = foo.fooChildren.get(3);

		assert.instanceOf(child1, FooModel, "First child in Collection instantiated properly.");
		assert.instanceOf(lastChild, FooModel, "Last child in Collection instantiated properly.");

		const ref1 = lastChild!.fooReference;
		const ref2 = lastChild!.fooReferences.get(0);
		const ref3 = lastChild!.fooReferences.get(1);

		assert.equal(ref1, child1, "Reference Property resolved correctly");
		assert.equal(ref2, child2, "First Collection reference resolved correctly");
		assert.equal(ref3, child3, "Second Collection reference resolved correctly");
	});
	it('property can be a function.', ()=> {
		class FooModel extends Model {
			@property(Function)
			foo?:()=>void;
		}
		let foo = new FooModel();
		foo.foo = ()=>{};

		let expected = ()=>{};
		foo = FooModel.create({
			foo:expected
		});
		assert.equal(foo.foo, expected);
	});
	it('notifies changes to watchers and deep watchers.', ()=>{
		class FooModel extends Model {
			@property(FooModel)
			foo?:FooModel;

			@property(String)
			bar?:string;
		}

		const model = FooModel.create<FooModel>({
			foo: {
				foo: {
					bar: 'foobar'
				}
			}
		});

		let count = 0;
		model.watch({
			path: 'foo.foo.bar',
			handler: (newValue, oldValue) => {
				assert.equal(oldValue, 'foobar', "Old value was correct");
				assert.equal(newValue, 'barfoo', "New value was correct");
				count++;
			}
		});
		model.watch({
			path: 'foo.foo',
			handler: (newValue, oldValue) => {
				assert.equal((<FooModel>oldValue).bar, 'foobar', "Old nested value was correct");
				assert.equal((<FooModel>newValue).bar, 'barfoo', "New nested value was correct");
				count++;
			}
		})
		model.watch({
			path: 'bar',
		 	handler: ()=> {
				assert.ok(false, "Incorrect watched notified");
				count++;
			}
		});
		model.watch({
			path: 'foo',
			deep: true,
			handler: ()=> {
				assert.ok(true, "Deep watcher notified");
				count++;
			}
		});
		model.watch({
			path: 'bar',
			deep: true,
			handler: ()=>{
				assert.ok(false, "Incorrect deep watcher notified.");
				count++;
			}
		});

		if(!model.foo) return;
		model.foo.setData({foo: {bar: 'barfoo'}}, true);

		assert.equal(count, 3, "Correct number of handlers called");
	});
});
