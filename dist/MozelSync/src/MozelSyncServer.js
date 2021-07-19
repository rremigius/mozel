import { Server } from "socket.io";
import MozelSync from "./MozelSync";
import Log from "../log";
import { isNumber } from "../../utils";
const log = Log.instance("mozel-sync-server");
export default class MozelSyncServer {
    constructor(options) {
        this.destroyCallbacks = [];
        const $options = options || {};
        let sync = $options.sync;
        if (!sync) {
            sync = new MozelSync({ priority: 1, autoCommit: 100 });
            if ($options.model) {
                sync.syncRegistry($options.model.$registry);
            }
        }
        this.sync = sync;
        let io = $options.io;
        if (io instanceof Server) {
            this.io = io;
            this.isDefaultIO = false;
        }
        else {
            this.io = new Server();
            this.isDefaultIO = true;
        }
        this.port = isNumber($options.io) ? $options.io : 3000;
    }
    start() {
        this.sync.start();
        this.io.on('connection', (socket) => {
            this.initUser(socket.id, socket);
            socket.on('disconnect', () => {
                this.removeUser(socket.id);
            });
            // Listen to incoming updates
            socket.on('push', commit => {
                const merged = this.sync.merge(commit);
                this.io.emit('push', merged); // send merged update to others
            });
        });
        if (this.isDefaultIO) {
            this.io.listen(this.port);
        }
        this.destroyCallbacks.push(this.sync.events.newCommits.on(event => {
            this.io.emit('push', event.updates);
        }));
        log.info("MozelSyncServer started.");
    }
    stop() {
        this.io.close();
        this.sync.stop();
    }
    initUser(id, socket) {
        socket.emit('connection', { id: socket.id });
        socket.emit('full-state', this.sync.createFullStates());
        this.onUserConnected(id);
    }
    removeUser(id) {
        this.onUserDisconnected(id);
    }
    onUserConnected(id) {
        // For overide
    }
    onUserDisconnected(id) {
        // For override
    }
    destroy() {
        this.destroyCallbacks.forEach(callback => callback());
    }
}
//# sourceMappingURL=MozelSyncServer.js.map