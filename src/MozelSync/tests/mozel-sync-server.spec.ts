import {assert} from "chai";
import MozelSyncServer from "../src/MozelSyncServer";
import MozelSyncClient from "../src/MozelSyncClient";
import Mozel, {collection, property, string} from "../../Mozel";
import MozelSync from "../src/MozelSync";
import Collection from "../../Collection";
import {interval} from "../../utils";

describe("MozelSyncServer", () => {
	describe("onUserConnected", () => {
		it("is called when a MozelSyncClient connects", () => {
			const server = new MozelSyncServer();
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserConnected = (id:string) => {
					server.stop();
					resolve();
				};
			});

			const client = new MozelSyncClient();
			client.connect();
			return promise;
		});
	});
	describe("onUserDisconnected", () => {
		it("is called when a MozelSyncClient disconnects", () => {
			const server = new MozelSyncServer();
			server.start();

			const promise = new Promise<void>((resolve, reject) => {
				server.onUserDisconnected = (id:string) => {
					server.stop();
					resolve();
				}
			});

			const client = new MozelSyncClient();
			client.onConnected = (id:string) => {
				client.disconnect();
			};
			client.connect();

			return promise;
		});
	});
	describe("updates", () => {
		it("when server model is changed, updates are emitted to client", async () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const init = {gid: 'root'}
			const model = Foo.create<Foo>(init);
			const sync = new MozelSync({registry: model.$registry, autoUpdate: 100});
			const server = new MozelSyncServer(sync);
			server.start();

			const clientModel = Foo.create<Foo>(init);
			const clientSync = new MozelSync({registry: clientModel.$registry, autoUpdate: 100});
			const client = new MozelSyncClient(clientSync);
			await client.connect();

			assert.notEqual(clientModel.foo, 'foo');

			model.foo = 'foo';

			return new Promise((resolve, reject) => {
				setTimeout(()=>{
					assert.equal(clientModel.foo, 'foo');
					server.stop();
					resolve();
				}, sync.autoUpdate! + 100);
			});
		});
		it("when client model is changed, updates are emitted to the server", async () => {
			class Foo extends Mozel {
				@property(String)
				foo?:string;
			}
			const init = {gid: 'root'}
			const model = Foo.create<Foo>(init);
			const sync = new MozelSync({registry: model.$registry, autoUpdate: 100});
			const server = new MozelSyncServer(sync);
			server.start();

			const clientModel = Foo.create<Foo>(init);
			const clientSync = new MozelSync({registry: clientModel.$registry, autoUpdate: 100});
			const client = new MozelSyncClient(clientSync);
			await client.start();

			assert.notEqual(clientModel.foo, 'foo');

			clientModel.foo = 'foo';

			return new Promise((resolve, reject) => {
				setTimeout(()=>{
					assert.equal(model.foo, 'foo');
					server.stop();
					resolve();
				}, clientSync.autoUpdate! + 100);
			});
		});
	});
	describe("connection", () => {
		it("full updates are sent to client on connection", async () => {
			class Foo extends Mozel {
				@string()
				name?:string;
				@property(Foo)
				foo?:Foo;
			}
			const serverModel = Foo.create<Foo>({
				gid: 'root',
				name: 'Root',
				foo: {gid: 'root.foo', name: 'RootFoo'}
			});
			const serverSync = new MozelSync({registry: serverModel.$registry});
			const server = new MozelSyncServer(serverSync);
			server.start();

			const clientModel = Foo.create<Foo>({gid: 'root'});
			const clientSync = new MozelSync({registry: clientModel.$registry});
			const client = new MozelSyncClient(clientSync);
			await client.connect();

			assert.deepEqual(serverModel.$export(), clientModel.$export(), "Client model synced with server model");
			server.stop();
		});
	});
	describe("(Integration) multiple clients", () => {
		it("models are synced between all clients and server", async () => {
			class Foo extends Mozel {
				@string()
				name?:string;
				@property(Foo)
				foo?:Foo;
				@collection(Foo)
				foos!:Collection<Foo>
			}
			const serverModel = Foo.create<Foo>({
				gid: 'root',
				name: 'Root',
				foo: {gid: 'root.foo', name: 'RootFoo'},
				foos: [
					{gid: 'root.foos.0', name: 'RootFoos0'},
					{gid: 'root.foos.1', name: 'RootFoos1', foo: {gid: 'root.foos.1.foo', name: 'RootFoos1Foo'}}]
			});
			const client1Model = Foo.create<Foo>({gid: 'root'})
			const client2Model = Foo.create<Foo>({gid: 'root'})
			const serverSync = new MozelSync({registry: serverModel.$registry, priority: 1, autoUpdate: 50})
			const client1Sync = new MozelSync({registry: client1Model.$registry, autoUpdate: 50});
			const client2Sync = new MozelSync({registry: client2Model.$registry, autoUpdate: 50});

			const server = new MozelSyncServer(serverSync);
			const client1 = new MozelSyncClient(client1Sync);
			const client2 = new MozelSyncClient(client2Sync);

			server.start();
			await client1.start();
			await client2.start();

			assert.exists(client1Model.foo, "RootFoo synced to client1");
			assert.exists(client2Model.foos.get(1)!.foo, "RootFoos2Foo synced to client 2");

			client1Model.foo!.name = 'RootFoo-client1';
			client2Model.foo!.name = 'RootFoo-client2';
			serverModel.foo!.name = 'Root-server';

			client1Model.foos.get(0)!.name = 'RootFoos0-client1';
			client2Model.foos.removeIndex(0);

			await interval(serverSync.autoUpdate! * 3);
			console.log("\n\n-------------------------------------------------------\n\n")

			assert.deepEqual(client1Model.$export(), serverModel.$export(), "Server and client1 in sync");
			assert.deepEqual(client2Model.$export(), serverModel.$export(), "Server and client2 in sync");
			assert.equal(serverModel.foo!.name, 'Root-server');

			client1Model.foos.get(0)!.$set('foo', {name: 'RootFoos1Foo-client1'});
			client2Model.foo!.name = 'Root-client2';

			await interval(serverSync.autoUpdate! * 3);
			console.log("\n\n-------------------------------------------------------\n\n")

			assert.deepEqual(client1Model.$export(), serverModel.$export(), "Server and client1 in sync");
			assert.deepEqual(client2Model.$export(), serverModel.$export(), "Server and client2 in sync");
			assert.equal(serverModel.foos.get(0)!.foo!.name, 'RootFoos1Foo-client1');
			assert.equal(serverModel.foo!.name, 'Root-client2');
		});
	});
});
