import Mozel, {Collection} from "../src"
import MozelDist, {Collection as CollectionDist} from "../dist"

class FooMozel extends Mozel {
	foo:string = 'foo'
}
class BarMozel extends FooMozel {
	bar:string = 'bar'
}
const foo:FooMozel = new BarMozel();
const collection:Collection<FooMozel> = new Collection<BarMozel>(foo, 'foo');


class FooMozelDist extends MozelDist {
	foo:string = 'foo'
}
class BarMozelDist extends FooMozelDist {
	bar:string = 'bar'
}
const fooDist:FooMozelDist = new BarMozelDist();
const collectionDist:CollectionDist<FooMozelDist> = new CollectionDist<BarMozelDist>(fooDist, 'foo');
