class SiteOSClient {
    constructor (options) {
        this.listeners = {}

        this.options = options

        this.#init()
    }

    #init () {
        // send app icon and what not here

        window.addEventListener('message', this.#onMessage)
    }

    #onMessage (event) {
        const { name, data } = event.data

        const listener = this.listeners[name]

        if (!listener) return

        listener(data)
    }

    #postMessage (data) {
        window.parent.postMessage(data, window.parent.location.origin)
    }

    #uniqueID () {
        return Math.floor(Math.random() * Date.now())
    }

    on (name, cb) {
        this.listeners[name] = cb
    }

    off (name) {
        delete this.listeners[name]
    }

    emit (name, data) {
        const eventID = this.#uniqueID()

        const payload = {
            name,
            data,
            eventID
        }

        this.#postMessage(payload)
    }
}
