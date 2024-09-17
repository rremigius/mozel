import Collection, {collection} from "../src/Collection";
import Mozel, {property, reference} from "../src/Mozel";
import MozelFactory from "../src/MozelFactory";
import {it} from "mocha";
import {assert} from "chai";
import {uniq} from "lodash-es";

describe("MozelFactory", () => {
	describe("createSet", () => {
		it("resolves references within the set based on gid", () => {
			let factory = new MozelFactory();

			class Person extends Mozel {
				@collection(Person, {reference})
				likes!:Collection<Person>;
			}
			factory.register(Person);

			let data = [
				{gid: 'james', likes: [{gid: 'lisa'}, {gid: 'frank'}]},
				{gid: 'lisa', likes: [{gid: 'james'}, {gid: 'frank'}]},
				{gid: 'jessica', likes: [{gid: 'jessica'}, {gid: 'james'}, {gid: 'frank'}]},
				{gid: 'frank', likes: [{gid: 'lisa'}]}
			];

			let people = factory.createSet(Person, data);

			assert.equal(people[0].likes.$at(1), people[3]); // both frank
			assert.equal(people[0].likes.$at(1), people[1].likes.$at(1)); // both frank
			assert.equal(people[2].likes.$at(0), people[2]); // jessica likes herself
		})
	});
	describe("create", () => {
		it('generates submozels based on _type property.', () => {
			const factory = new MozelFactory();

			class FooMozel extends Mozel {}
			class SubFooMozel extends FooMozel {}
			class BarMozel extends Mozel {
				@property(Mozel)
				foo?:Mozel;
				@collection(Mozel)
				foos!:Collection<Mozel>;
			}
			factory.register([FooMozel, SubFooMozel, BarMozel]);

			// Instantiate mozel
			const bar = factory.create(BarMozel, {
				foo: {_type:'FooMozel'},
				foos: [{_type:'FooMozel'}, {_type: 'SubFooMozel'}]
			});

			assert.instanceOf(bar.foo, FooMozel, "Created property submozel is of correct class");
			assert.instanceOf(bar.foos.$at(0), FooMozel, "Created collection submozel is of correct class");
			assert.instanceOf(bar.foos.$at(1), SubFooMozel, "Subclass was instantiated correctly")
		});
		it('resolves Mozel types based on its container', () => {
			let romeFactory = new MozelFactory();
			let egyptFactory = new MozelFactory();

			class Roman extends Mozel {}
			romeFactory.register(Roman, 'Person');

			class Egyptian extends Mozel {}
			egyptFactory.register(Egyptian, 'Person');

			const data = {_type: 'Person'};
			let roman = romeFactory.create(Mozel, data);
			let egyptian = egyptFactory.create(Mozel, data);

			assert.instanceOf(roman, Roman, "Roman mozel instantiated correctly");
			assert.instanceOf(egyptian, Egyptian, "Egyptian mozel instantiated correctly");
		});
		it('created with MozelFactory gets assigned a unique GID if it does not already have one.', () => {
			class FooMozel extends Mozel {
				@property(FooMozel)
				foo?:FooMozel;
			}
			const factory = new MozelFactory();
			factory.register(FooMozel);

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
		it('resolves reference Properties from Registry.', ()=> {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				fooChildren!:Collection<FooMozel>;
				@property(FooMozel, {reference})
				fooReference?:FooMozel;
				@collection(FooMozel, {reference})
				fooReferences!:Collection<FooMozel>;
			}
			const factory = new MozelFactory();
			factory.register(FooMozel);

			const foo = factory.create<FooMozel>(FooMozel, {
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
			});

			const child1 = foo.fooChildren.$at(0);
			const child2 = foo.fooChildren.$at(1);
			const child3 = foo.fooChildren.$at(2);
			const lastChild = foo.fooChildren.$at(3);

			assert.instanceOf(child1, FooMozel, "First child in Collection instantiated properly.");
			assert.instanceOf(lastChild, FooMozel, "Last child in Collection instantiated properly.");

			const ref1 = lastChild!.fooReference;
			const ref2 = lastChild!.fooReferences.$at(0);
			const ref3 = lastChild!.fooReferences.$at(1);

			assert.equal(ref1, child1, "Reference Property resolved correctly");
			assert.equal(ref2, child2, "First Collection reference resolved correctly");
			assert.equal(ref3, child3, "Second Collection reference resolved correctly");
		});
	});
})
