import {assert} from "chai";
import Mozel, {Collection, MozelFactory, property, required} from "../src";
import {describe} from "mocha";
import {collection} from "../src/Collection";

function time(nTimes:number, callback:(iteration:number)=>void) {
	const start = Date.now();
	for(let i = 0; i < nTimes; i++) {
		callback(i);
	}
	return Date.now()-start;
}

describe("Performance", () => {
	describe("Mozel", () => {
		describe("setting a property", () => {
			it("without any watchers takes less than 70 times as long as setting a property on a plain object", () => {
				class Foo extends Mozel {
					@property(String)
					foo?:string;
				}
				const foo = Foo.create<Foo>();
				const ref = {foo: '0'};

				const nTimes = 100000;
				const duration = time(nTimes, i => foo.foo = i.toString());
				const refDuration = time(nTimes, i => ref.foo = i.toString());

				assert.isBelow(duration, refDuration * 50);
			});
			it("with a watcher takes less than 3 times as long as setting a property without a watcher", () => {
				class Foo extends Mozel {
					@property(String)
					foo?:string;
				}
				const foo = Foo.create<Foo>();
				foo.$watch('foo', change => {});

				const ref = Foo.create<Foo>();

				const nTimes = 50000;
				const duration = time(nTimes, i => foo.foo = i.toString());
				const refDuration = time(nTimes, i => ref.foo = i.toString());

				assert.isBelow(duration, refDuration * 3);
			});
			it("with 2 watchers takes less than 2 times as long as setting a property with 1 watcher", () => {
				class Foo extends Mozel {
					@property(String)
					foo?:string;
				}
				const foo = Foo.create<Foo>();
				foo.$watch('x', change => {});
				foo.$watch('y', change => {});

				const ref = Foo.create<Foo>();
				ref.$watch('x', change => {});

				const duration = time(100000, i => foo.foo = i.toString());
				const refDuration = time(100000, i => ref.foo = i.toString());

				assert.isBelow(duration, refDuration * 2);
			});
		});
		describe("traversing a Collection", () => {
			it("takes less than 3 times as long as traversing an array", () => {
				class Foo extends Mozel {
					@collection(Number, undefined, {required})
					foos!:Collection<number>
				}

				const nTimes = 100;
				const nItems = 10000;
				const foo = Foo.create<Foo>();
				const refs:number[] = [];
				for(let i=0; i<nItems; i++) {
					foo.foos.$add(i);
					refs.push(i);
				}
				const foos = foo.foos;
				const duration = time(nTimes, ()=>foos.$each(()=>{}));
				const refDuration = time(nTimes, ()=>refs.forEach(()=>{}));

				assert.isBelow(duration, refDuration * 3);
			});
		});
		describe("creating a Foo instance", () => {
			it("takes less than 1 ms", () => {
				class Foo extends Mozel {
					@property(String)
					name?:string;
					@property(Foo)
					foo?:Foo;
					@collection(Foo)
					foos!:Collection<Foo>;
				}
				const factory = new MozelFactory();
				const nTimes = 1000;
				const duration = time(nTimes, i =>
					factory.create(Foo, {name: i.toString(), foo: {}, foos: [{}]})
				);

				assert.isBelow(duration, nTimes);
			});
		});
	});
});
