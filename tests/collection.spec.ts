import {assert} from 'chai';
import {describe,it} from 'mocha';

import Mozel, {collection} from "../src/Mozel";
import Collection from "../src/Collection";

describe("Collection", () => {
	describe(".onAdded", () => {
		it("adds a listener that will be called when an item is added", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			let assertions = 0;
			foo.other.onAdded((item:FooMozel) => {
				assert.ok(item instanceof FooMozel);
				assertions++;
			});
			foo.other.add(bar);
			assert.equal(assertions, 1, "Right number of listeners called");
		});
	});
	describe(".onRemoved", () => {
		it("adds a listener that will be called when an item is removed", () => {
			class FooMozel extends Mozel {
				@collection(FooMozel)
				other!:Collection<FooMozel>;
			}
			let foo = FooMozel.create<FooMozel>();
			let bar = FooMozel.create<FooMozel>();

			let assertions = 0;
			foo.other.onRemoved((item:FooMozel) => {
				assert.ok(item instanceof FooMozel);
				assertions++;
			});
			foo.other.add(bar);
			foo.other.remove(bar);
			assert.equal(assertions, 1, "Right number of listeners called");
		});
	})
});
