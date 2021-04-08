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
    @property(String, {required, default: 'John Doe'}) // runtime typing
    name!:string; // compile-time (Typescript) typing
    
    @collection(String) // runtime typing
    nicknames!:Collection<String>; // compile-time (Typescript) typing
}
```

Note that, if you set `{required}` on a `@property`, you can safely assume the value will never be undefined.
In Typescript, you can therefore use `!` with the property. Without `{required}`, you should use `?`.
Collections are always instantiated and therefore will never be undefined.

Javascript:

```javascript
import Mozel, {required} from "mozel";

class Person extends Mozel {}
Person.property('name', String, {required});
Person.collection('nicknames', String);
```

To set a default, use `{default: ...}` in the property options, instead of `myProperty:string = 'myDefault'`.

### Instantiation

A Mozel can be instantiated with data using the static `create` method. The instantiation is the same for Javascript and
Typescript, but in Typescript, the plain instantiation object will be strongly typed according to the Mozel's properties. 

```typescript
let person = Person.create({
    name: 'James',
    nicknames: ['Johnny', 'Jack']
});

console.log(person.name); // James
console.log(person.nicknames.toArray()); // ['Johnny', 'Jack']
```

Only valid values will be accepted:

```typescript
person.name = 123;
console.log(person.name); // still 'James'
```

### Type definitions

In Typescript, each property has runtime type definition, as well as a Typescript type definition. These should always
match for the mozel to be considered type-safe.

**Examples**:

| Runtime definition                | Typescript definition         | Description
|:--                                | :--                           |:--
| `@property(String)`               | `foo?:string`                 | Optional string
| `@property(Number)`               | `foo?:number`                 | Optional number
| `@property(Alphanumeric)`         | `foo?:alphanumeric`           | Optional string or number
| `@property(MyMozel)`              | `foo?:MyMozel`                | Optional instanceof MyMozel
| `@collection(String)`             | `foo!:Collection<string>`     | Collection of strings*
| `@collection(MyMozel)`            | `foo!:Collection<MyMozel>`    | Collection of MyMozels*
| `@property(String, {required})`   | `foo!:string`                 | Required string, defaults to emtpy string
| `@property(String, {required, default: "foo"})`   | `foo!:string` | Required string, defaults to `"foo"`

\* Collections are always defined at initialization, even if empty. It is therefore safe to place the `!` in the Typescript definition.

### Nested Mozels

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
the collection should be. A Collection on a Mozel will always be instantiated with the Mozel, so it cannot be `undefined`.

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

### Transferral

A Mozel can only have one parent (although multiple Mozels can reference it). If it is transferred from one parent 
to another, the original parent's property is automatically set to undefined.

```typescript
let baxter = Dog.create({name: 'Baxter'});
let james = Person.create({
    dog: baxter
})
let lisa = Person.create();

// James has the dog
console.log(james.dog.name); // baxter
console.log(lisa.dog); // undefined

// Transfer to Lisa
lisa.dog = baxter;

// Lisa has the dog; James no longer has a dog
console.log(james.dog); // undefined
console.log(lisa.dog.name); // baxter
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
let exported = person.$export();
let imported = Person.create(exported);

console.log(person.name, imported.name); // both 'James'
console.log(person.dogs.get(1).name); // both 'Baxter'
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

james.$watch('dog.toy.state', (newState, oldState) => { /*...*/ }); // watcher A
james.$watch('dog.toy', (newToy, oldToy) => { /*...*/ }); // watcher B
james.$watch('dog', (newDog, oldDog) => { /*...*/ }); // watcher C
james.$watch('dog', (newDog, oldDog) => { /*...*/ }, {deep: true}); // watcher D

james.dog = Dog.create(); // potentially triggers watchers A, B, C and D
james.dog.toy = Toy.create(); // potentially triggers watchers A, B and D
james.dog.toy.state = 'old'; // potentially triggers watchers A and D
```

Note: watchers only get triggered if the new value is different than the old value. 
If a new dog has a toy with the same state, the `dog.toy.state` watcher will not be triggered.

##### Using `schema`

Using `schema` in a watcher can provide Typescript type checking:

```typescript
james.$watch(schema(Person).dog.toy, (newToy:Toy, oldToy:Toy) => {
    // schema provides type for handler; no need for type casting in handler
})
```

#### Wildcard watchers

Wildcards (`*`) can be used in the watcher's path to match any property. This can also be used to watch for changes
in any of a Collection's items: 

```typescript
class Toy extends Mozel {
    @property(String, {required})
    name!:string;
}
class Dog extends Mozel {
    @collection(Toy)
    toys!:Collection<Toy>;
}
let dog = Dog.create({
   toys: [{name: 'ball'}, {name: 'stick'}] 
});
dog.$watch('toys.*.name', (newName, oldName, path) => {
    // do something if the name of any toy changes
    // `path` argument will provide the actual path that changed
});
```

#### Watcher properties

A watcher can be configured with the following properties:

- `path`: (string, required): The path from the current Mozel to watch.
- `handler`: (function, required): The handler to call when a value changes. Takes three arguments:
    - `newValue`: the new value
    - `oldValue`: the value before the change
    - `path`: the path that changed
- `deep`: (boolean) If set to `true`, will respond to changes deeper than the given path. Will make a deep clone to provide the old value.
- `immediate`: (boolean) If set to `true`, will call the handler immediately with the current value.

### Non-strict mode

Mozels can be set to non-strict mode, in which they will accept invalid property values and will report errors where
the values are invalid. Note that, in that case, the mozel will *not* be considered type-safe, even though Typescript
cannot report the type errors. Runtime type checking should always be performed if non-strict mozel properties are used.

```typescript
let james = Person.create({
    name: 'James',
    dog: { name: 'Bobby' }
});
james.$strict = false;
james.dog.name = 123;

console.log(james.dog.$errors.name); // Error: Dog.name expects string.
console.log(james.$errorsDeep()['dog.name']); // Error: Dog.name expects string.
```

## Advanced

### ModelFactory

The ModelFactory enhances plain-data import, allowing to 1) instantiate different subtypes of Mozels, 2) make references 
between sub-Mozels and 3) inject Mozel dependencies.

#### Mozel subtype instantiation

```typescript
// Definitions

class Person extends Mozel {
    @collection(Dog)
	dogs!:Collection<Dog>;
}
class Dog extends Mozel {}
class Pug extends Dog {}
class StBernard extends Dog {}

// Instances

let factory = new MozelFactory();
factory.register(Dog, Pug, StBernard);
let james = factory.create(Person, {
    dogs: [{_type: 'Pug'}, {_type: 'StBernard'}]
});

console.log(james.dogs.get(0) instanceof Pug); // true
console.log(james.dogs.get(1) instanceof StBernard); // true
```

#### References between sub-Mozels

All mozels have a built-in `gid` property. This property allows the MozelFactory to uniquely identify Mozels, and
make references rather than nested Mozels.

```typescript
// Definitions

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
factory.register(Person);
let people = factory.createSet(data);

console.log(people[0].likes.get(1) === people[3]); // true (both frank)
console.log(people[0].likes.get(1) === people[1].likes.get(1)); // true (both frank)

```

### Mozel dependency injection

```typescript
let rome = new MozelFactory();
let egypt = new MozelFactory();

// Definitions

class Roman extends Mozel {
    static get type() {
        return 'Person';
    }
}
rome.register(Roman);

class Egyptian extends Mozel {
    static get type() {
        return 'Person'
    }
}
egypt.register(Egyptian);

// Instances

let data = {_type: 'Person'};
let roman = rome.create(data);
let egyptian = egypt.create(data);

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

### Logging

Mozel has fine-grained logging controls, based on the [Log Control](https://www.npmjs.com/package/log-control) library.
For example, it is possible to change the log levels for Mozel, or use a custom driver rather than `console`:

```typescript
Mozel.log.setLevel(LogLevel.OFF);
Mozel.log.setDriver({
    trace(...args:any[]){ /* ... */ },
    debug(...args:any[]){ /* ... */ },
    log(...args:any[]){ /* ... */ },
    info(...args:any[]){ /* ... */ },
    warn(...args:any[]){ /* ... */ },
    error(...args:any[]){ /* ... */ }
});
```
