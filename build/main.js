"use strict";
/*
 * Created with @iobroker/create-adapter v2.0.1
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const axios_1 = __importDefault(require("axios"));
const net = __importStar(require("net"));
class FlicHub extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "flic-hub",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.log.debug("HubIP: " + JSON.stringify(this.config.hubIP));
        if (this.config.hubIP.length == 0 || typeof this.config.hubIP == "object") {
            // hubIP not set -> lets discover it
            this.log.debug(`Discovering hub because config ip is ${this.config.hubIP}`);
            const discover = await axios_1.default.get("https://api.flic.io/api/v1/hub/ip");
            this.log.debug(JSON.stringify(discover.data));
            if (discover && discover.data) {
                discover.data.forEach((h) => {
                    if (h && h.local_ip) {
                        const client = new net.Socket();
                        client.setKeepAlive(true, 5000);
                        this.log.debug(`connecting to ${h.local_ip}:${this.config.hubPort}`);
                        client.connect(this.config.hubPort, h.local_ip, () => {
                            this.log.info(`connected to ${h.local_ip}:${this.config.hubPort}`);
                        });
                        client.on("data", (data) => {
                            this.log.debug(`received data from flic hub ${h.serial_number} : ${data}`);
                            const event = JSON.parse(data.toString());
                            try {
                                switch (event.name) {
                                    case "buttons":
                                        this._createButtons(h, event.buttons);
                                        break;
                                    case "click":
                                        this._handleButtonClick(h, event.eventObj, event.button);
                                        break;
                                }
                            }
                            catch (err) {
                                this.log.error(`parsing the datagram from the hub failed ${err}`);
                            }
                        });
                        const reconnect = () => {
                            setTimeout(() => {
                                this.log.debug("client tries to reconnect");
                                try {
                                    client.connect(this.config.hubPort, h.local_ip);
                                }
                                catch (err) {
                                    this.log.error(err);
                                    reconnect();
                                }
                            }, 10 * 1000);
                        };
                        client.on("close", () => {
                            this.log.debug("client lost connection");
                            reconnect();
                        });
                    }
                });
            }
        }
    }
    async _handleButtonClick(hub, event, button) {
        if (event && button && button.connected) {
            if (event.isSingleClick) {
                const currentState = await this.getStateAsync(`${hub.serial_number}.${event.bdaddr}.button`);
                await this.setStateAsync(`${hub.serial_number}.${event.bdaddr}.button`, {
                    val: currentState ? !currentState.val : false,
                    ack: true,
                });
            }
            else if (event.isDoubleClick) {
                const currentState = await this.getStateAsync(`${hub.serial_number}.${event.bdaddr}.buttonDouble`);
                await this.setStateAsync(`${hub.serial_number}.${event.bdaddr}.buttonDouble`, {
                    val: currentState ? !currentState.val : false,
                    ack: true,
                });
            }
            else if (event.isHold) {
                const currentState = await this.getStateAsync(`${hub.serial_number}.${event.bdaddr}.buttonLong`);
                await this.setStateAsync(`${hub.serial_number}.${event.bdaddr}.buttonLong`, {
                    val: currentState ? !currentState.val : false,
                    ack: true,
                });
            }
            // update batteryStatus
            await this.setStateAsync(`${hub.serial_number}.${event.bdaddr}.batteryStatus`, {
                val: button.batteryStatus,
                ack: true,
            });
        }
    }
    /**
     * is called whenever the flic hub sends a buttons event
     * @param buttons
     * @private
     */
    async _createButtons(hub, buttons) {
        await this.setObjectNotExistsAsync(hub.serial_number, {
            type: "device",
            common: {
                name: hub.serial_number,
            },
            native: {
                target_firmware: hub.target_firmware,
                latest_firmware: hub.latest_firmware,
            },
        });
        if (buttons) {
            buttons.forEach(async (b) => {
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}`, {
                    type: "device",
                    common: {
                        name: b.name,
                    },
                    native: {},
                });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.name`, {
                    type: "state",
                    common: {
                        name: "name",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.name`, { val: b.name, ack: true });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.bdaddr`, {
                    type: "state",
                    common: {
                        name: "bdaddr",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.bdaddr`, { val: b.bdaddr, ack: true });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.batteryStatus`, {
                    type: "state",
                    common: {
                        name: "batteryStatus",
                        type: "number",
                        role: "value.battery",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.batteryStatus`, {
                    val: b.batteryStatus,
                    ack: true,
                });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.color`, {
                    type: "state",
                    common: {
                        name: "color",
                        type: "string",
                        role: "text",
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.color`, {
                    val: b.color,
                    ack: true,
                });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.button`, {
                    type: "state",
                    common: {
                        name: "button",
                        type: "boolean",
                        role: "button",
                        read: false,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.button`, {
                    val: false,
                    ack: true,
                });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.buttonLong`, {
                    type: "state",
                    common: {
                        name: "buttonLong",
                        type: "boolean",
                        role: "button.long",
                        read: false,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.buttonLong`, {
                    val: false,
                    ack: true,
                });
                await this.setObjectNotExistsAsync(`${hub.serial_number}.${b.bdaddr}.buttonDouble`, {
                    type: "state",
                    common: {
                        name: "buttonDouble",
                        type: "boolean",
                        role: "button.double",
                        read: false,
                        write: true,
                    },
                    native: {},
                });
                await this.setStateAsync(`${hub.serial_number}.${b.bdaddr}.buttonDouble`, {
                    val: false,
                    ack: true,
                });
            });
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            callback();
        }
        catch (e) {
            callback();
        }
    }
    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new FlicHub(options);
}
else {
    // otherwise start the instance directly
    (() => new FlicHub())();
}
//# sourceMappingURL=main.js.map