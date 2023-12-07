class SiteOSController {
    constructor (url) {
        this.url = url

        this.origin = new URL(url).origin

        this.listeners = {}

        this.instances = []

        this.hiddenContainerID = 'site-os-hidden-container'

        this.#init()
    }

    #init () {
        window.addEventListener('message', (event) => this.#onMessage(event))

        this.#createHiddenContainer()
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

    #createHiddenContainer () {
        const hiddenContainer = document.getElementById(this.hiddenContainerID)

        if (hiddenContainer) return

        const div = document.createElement('div')

        div.id = this.hiddenContainerID

        div.style.display = 'none'

        document.body.appendChild(div)
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

    launch (containerId) {
        const iframe = document.createElement('iframe')

        iframe.src = this.url

        iframe.style.width = '100%'
        iframe.style.height = '100%'

        let container

        if (containerId) {
            container = document.getElementById(containerId)
        }

        if (!container) {
            container = document.getElementById(this.hiddenContainerID)
        }

        container.appendChild(iframe)

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
}
