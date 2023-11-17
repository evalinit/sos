class SiteOSController {
    constructor (url) {
        this.url = url

        this.origin = new URL(url).origin

        this.listeners = {}

        this.instances = []

        this.#init()
    }

    #init () {
        window.addEventListener('message', (event) => this.#onMessage(event))

        this.createInstance()
    }

    #onMessage (event) {
        if (event.origin !== this.origin) return

        const { name, args } = event.data

        const listener = this.listeners[name]

        if (!listener) return

        let targetInstance

        for (const instance of this.instances) {
            // TODO: handle tabs
            
            if (instance.target.contentWindow !== event.source) continue

            targetInstance = instance
        }

        listener(...args, targetInstance)
    }

    createInstance () {
        const iframe = document.createElement('iframe')

        iframe.src = this.url

        document.body.appendChild(iframe)

        const instance = {
            target: iframe,
            type: 'iframe',
            origin: this.origin
        }

        instance.listeners = {}

        instance.on = function (name, cb) {
            this.listeners[name] = cb
        }

        instance.off = function (name) {
            delete this.listeners[name]
        }

        instance.emit = function (name, ...args) {
            const payload = {
                name,
                args
            }

            // TODO: handle tabs

            this.target.contentWindow.postMessage(payload, this.origin)
        }

        this.instances.push(instance)

        return instance
    }

    on (name, cb) {
        this.listeners[name] = cb
    }

    off (name) {
        delete this.listeners[name]
    }

    emit (name, ...args) {
        const payload = {
            name,
            args
        }

        for (const instance of this.instances) {
            // TODO: handle tabs

            instance.target.contentWindow.postMessage(payload, this.origin)
        }
    }
}
