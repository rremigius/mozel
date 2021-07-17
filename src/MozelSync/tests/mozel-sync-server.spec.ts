import {assert} from 'chai';
import MozelSyncServer from "../src/MozelSyncServer";
import MozelSyncClient from "../src/MozelSyncClient";

describe("MozelSyncServer", () => {
	it("can connect with a MozelSyncClient", async () => {
		const server = new MozelSyncServer();
		server.start();

		const promise = new Promise<void>((resolve, reject) => {
			server.onUserConnected = (id:string) => {
				assert.ok(true);
				resolve();
			};
		});

		const client = new MozelSyncClient();
		client.start();
		return promise;
	});
});
