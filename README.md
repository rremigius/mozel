Mozel 
===

A Mozel is a strongly-typed model, which ensures that its properties are of the correct type,
both at runtime and compile-time (Typescript). It is easy to define a Mozel, and it brings a number of useful features.

Mozel can be used both in Typescript and plain Javascript. 

## Features

- Nested models
- Strongly-typed properties and collections (both compile-time and runtime)
- Simple Typescript declarations
- Deep change watching
- Import/export from/to plain objects - allows easy transmission between systems through JSON.
- Deep string templating (e.g. {"name": "{username}"})

## Getting Started

### Definition

A Mozel definition is simple and can be done both in Typescript and plain Javascript:

Typescript:

```typescript
import Mozel, {required} from "mozel";

class Person extends Mozel {
    @property(String, {required})
    name!:string;
    
    @collection(String)
    nicknames!:Collection<String>;
}
```

Javascript:

```javascript
import Mozel, {required} from "mozel";

class Person extends Mozel {}
Person.property('name', String, {required});
Person.collection('nicknames', String);
```

### Instantiation

A Mozel can be instantiated with data using the static `create` method. The instantiation is the same for Javascript and
Typescript, but in Typescript, the plain instantiation object will be strongly typed according to the Mozel's properties. 

```typescript
let person = Person.create({
    name: 'James',
    nicknames: ['Johnny', 'Jack']
});

console.log(person.name); // James
console.log(person.nicknames.list); // ['Johnny', 'Jack']
```

Only predefined and valid property values will be accepted.

### Properties and nested Mozels

Properties can be either primitive, or other Mozels. 
Nested Mozels can be instantiated entirely by providing nested data to the `create` method, or partially by providing
existing Mozels for the nested data.

```typescript
// Definitions

class Dog extends Mozel {
    @property(String, {required})
	name!:string;
}
class Person extends Mozel {
    @property(String, {required})
    name!:string;

    @property(Dog)
    dog?:Dog;
}

// Instances

let bobby = Dog.create({
    name: 'Bobby'
});

// Lisa has an existing dog
let lisa = Person.create({
    name: 'Lisa',
    dog: bobby
})

// James has a new dog
let james = Person.create({
    name: 'James',
    dog: { // will create a new Dog called Baxter
        name: 'Baxter'
    }
});

console.log(lisa.dog instanceof Dog); //true
console.log(lisa.dog.name); // Bobby
console.log(james.dog instanceof Dog); // true
console.log(james.dog.name); // Baxter
```

### Collections

Collections can contain primitives (string/number/boolean) or Mozels. The definition determines which type all items in
the collection should be.

```typescript
// Definitions 

class Dog extends Mozel {
    @property(String, {required})
    name!:string;
}
class Person extends Mozel {
    @property(String, {required})
    name!:string;
    
    @collection(Dog)
    dogs!:Collection<Dog>;
}

// Instances

let james = Person.create({
    name: 'James',
    dogs: [{name: 'Baxter'}, {name: 'Bobby'}]
});

console.log(james.dogs.get(0) instanceof Dog); // true
console.log(james.dogs.map(dog => dog.name)); // ['Baxter', 'Bobby'] 
```

### Import/export

The import/export feature makes it easy to transmit a Mozel as plain object data or JSON to another system, and have it
reconstructed into a Mozel on the other side.

```typescript
// Definitions
class Dog extends Mozel {
    @property(String, {required})
    name!:string;
}
class Person extends Mozel {
    @property(String, {required})
    name!:string;
    
    @collection(Dog)
    dogs!:Collection<Dog>;
}

// Instances

let person = Person.create({
   name: 'James',
   dogs: [{name: 'Bobby'}, {name: 'Baxter'}]
});
let exported = person.export();
let imported = Person.create(exported);

console.log(person.name, imported.name); // both 'James'
console.log(person.dog.get(1).name); // both 'Baxter'
```

### Change watching

Throughout the hierarchy of the Mozel, you can watch for changes. Watchers can be defined at any level, but if watchers
need to persist even if some part of the hierarchy is replaced, they should be defined above the changing level in the 
hierarchy.

```typescript
// Definitions
class Toy extends Mozel {
    @property(String, {required, default: 'new'})
    state!:string;
}
class Dog extends Mozel {
    @property(Toy)
    toy?:Toy;
}
class Person extends Mozel {
    @property(Dog)
    dog?:Dog
}

// Instances

let james = Person.create<Person>({
    dog: {
        toy: {}
    }
});

// Watchers

james.watch({ // watcher A
    path: 'dog.toy.state',
    handler(newState, oldState) { /*...*/ }
});
james.watch({ // watcher B
    path: 'dog.toy',
    handler(newToy, oldToy) { /*...*/ }
});
james.watch({ // watcher C
    path: 'dog',
    handler(newDog, oldDog) { /*...*/ }
})
james.watch({ // watcher D
    path: 'dog',
    handler(newDog, oldDog) { /*...*/ },
    deep: true
});

james.dog = Dog.create(); // potentially triggers watchers A, B, C and D
james.dog.toy = Toy.create(); // potentially triggers watchers A, B and D
james.dog.toy.state = 'old'; // potentially triggers watchers A and D
```

Note: watchers only get triggered if the new value is different than the old value. 
If a new dog has a toy with the same state, the `dog.toy.state` watcher will not be triggered.

## Advanced

### ModelFactory

The ModelFactory enhances plain-data import, allowing to 1) instantiate different subtypes of Mozels, 2) make references 
between sub-Mozels and 3) inject Mozel dependencies.

#### Mozel subtype instantiation

```typescript
// Definitions

@injectableMozel()
class Person extends Mozel {
    @collection(Dog)
	dogs!:Collection<Dog>;
}

@injectableMozel()
class Dog extends Mozel {}

@injectableMozel()
class Pug extends Dog {}

@injectableMozel()
class StBernard extends Dog {}

// Instances

let factory = new MozelFactory();
let james = factory.create(Person, {
    dogs: [{_type: 'Pug'}, {_type: 'StBernard'}]
});

console.log(james.dogs.get(0) instanceof Pug); // true
console.log(james.dogs.get(1) instanceof StBernard); // true
```

Both the MozelFactory and the decorator `@injectableMozel` use a default dependency injection container.
All `injectableMozel`s will be added to that container and registered as candidates for instantiation,
based on the `_type` property of the initialisation data.

#### References between sub-Mozels

All mozels have a built-in `gid` property. This property allows the MozelFactory to uniquely identify Mozels, and
make references rather than nested Mozels.

```typescript
// Definitions

@injectableMozel()
class Person extends Mozel {
    @collection(Person, {reference})
    likes!:Collection<Person>;
}

// Instances

let data = [
    {gid: 'james', likes: [{gid: 'peter'}, {gid: 'frank'}]},
    {gid: 'lisa', likes: [{gid: 'james'}, {gid: 'frank'}]},
    {gid: 'jessica', likes: [{gid: 'jessica'}, {gid: 'james'}, {gid: 'frank'}]},
    {gid: 'frank', likes: [{gid: 'lisa'}]}
]

let factory = new MozelFactory();
let people = factory.createSet(data);

console.log(people[0].likes.get(2) === people[3]); // true (both frank)
console.log(people[0].likes.get(2) === people[1].likes.get(2)); // true (both frank)

```

### Mozel dependency injection

```typescript
let rome = MozelFactory.createDependencyContainer();
let romeFactory = new MozelFactory(rome);

let egypt = MozelFactory.createDependencyContainer();
let egyptFactory = new MozelFactory(egypt);

// Definitions

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

// Instances

let data = {_type: 'Person'};
let roman = romeFactory.create(data);
let egyptian = egyptFactory.create(data);

console.log(roman instanceof Roman); // true
console.log(egyptian instanceof Egyptian); // true

```
### Plain Javascript alternative

Without Typescript, the injectable Mozels can be written like this:

```javascript
let rome = MozelFactory.createDependencyContainer();

class Roman extends Mozel {}

Roman.injectable(rome);
```
