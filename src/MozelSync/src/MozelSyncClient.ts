import {io, Socket} from "socket.io-client"
import Log from "../log";
import {isNumber} from "../../utils";

const log = Log.instance("mozel-sync-client");

export default class MozelSyncClient {
	io:Socket;
	isDefaultIO:boolean;

	constructor(socket?:Socket|number) {
		this.isDefaultIO = !socket;
		if(socket instanceof Socket) {
			this.io = socket;
		} else {
			const port = isNumber(socket) ? socket : 3000;
			this.io = io(`http://localhost:${port}`);
		}

	}
	start() {
		this.io.connect();
	}
}
