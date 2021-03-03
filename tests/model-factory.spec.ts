import Collection from "../src/Collection";
import Mozel, {collection, injectableMozel, property, reference} from "../src/Mozel";
import MozelFactory from "../src/MozelFactory";
import {it} from "mocha";
import {Container} from "inversify";
import {assert} from "chai";

describe("MozelFactory", () => {
	describe(".createSet", () => {
		it("resolves references within the set based on gid", () => {
			const container = new Container({autoBindInjectable:true});
			let factory = new MozelFactory(container);

			@injectableMozel(container)
			class Person extends Mozel {
				@collection(Person, {reference})
				likes!:Collection<Person>;
			}

			let data = [
				{gid: 'james', likes: [{gid: 'lisa'}, {gid: 'frank'}]},
				{gid: 'lisa', likes: [{gid: 'james'}, {gid: 'frank'}]},
				{gid: 'jessica', likes: [{gid: 'jessica'}, {gid: 'james'}, {gid: 'frank'}]},
				{gid: 'frank', likes: [{gid: 'lisa'}]}
			]

			let people = factory.createSet(Person, data);

			console.log(people[0].likes.get(2) === people[3]); // true (both frank)
			console.log(people[0].likes.get(2) === people[1].likes.get(2)); // true (both frank)
		})
	});
	describe(".create", () => {
		it('resolves reference Properties from Registry.', ()=> {
			const container = new Container({autoBindInjectable:true});

			@injectableMozel(container)
			class FooMozel extends Mozel {
				@collection(FooMozel)
				fooChildren!:Collection<FooMozel>;
				@property(FooMozel, {reference})
				fooReference?:FooMozel;
				@collection(FooMozel, {reference})
				fooReferences!:Collection<FooMozel>;
			}
			const factory = new MozelFactory(container);
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
			}, true);

			const child1 = foo.fooChildren.get(0);
			const child2 = foo.fooChildren.get(1);
			const child3 = foo.fooChildren.get(2);
			const lastChild = foo.fooChildren.get(3);

			assert.instanceOf(child1, FooMozel, "First child in Collection instantiated properly.");
			assert.instanceOf(lastChild, FooMozel, "Last child in Collection instantiated properly.");

			const ref1 = lastChild!.fooReference;
			const ref2 = lastChild!.fooReferences.get(0);
			const ref3 = lastChild!.fooReferences.get(1);

			assert.equal(ref1, child1, "Reference Property resolved correctly");
			assert.equal(ref2, child2, "First Collection reference resolved correctly");
			assert.equal(ref3, child3, "Second Collection reference resolved correctly");
		});
		it('resolves Mozel types based on its container', () => {
			let rome = MozelFactory.createDependencyContainer();
			let romeFactory = new MozelFactory(rome);

			let egypt = MozelFactory.createDependencyContainer();
			let egyptFactory = new MozelFactory(egypt);

			@injectableMozel(rome)
			class Roman extends Mozel {
				static get type() {
					return 'Person';
				}
			}

			@injectableMozel(egypt)
			class Egyptian extends Mozel {
				static get type() {
					return 'Person'
				}
			}

			const data = {_type: 'Person'};
			let roman = romeFactory.create(Mozel, data);
			let egyptian = egyptFactory.create(Mozel, data);

			assert.instanceOf(roman, Roman, "Roman mozel instantiated correctly");
			assert.instanceOf(egyptian, Egyptian, "Egyptian mozel instantiated correctly");
		});
	})
})
