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
            const matchedFrame = instance.type === 'iframe' && (instance.target.contentWindow === event.source)

            const matchedTab = instance.type === 'tab' && (instance.target === event.source)
            
            if (!matchedFrame || !matchedTab) continue

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

    #createInstance (target, type) {
        const instance = {
            target,
            type,
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

            if (this.type === 'iframe') {
                this.target.contentWindow.postMessage(payload, this.origin)

                return
            }

            this.target.postMessage(payload, this.origin)
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
            if (instance.type === 'iframe') {
                instance.target.contentWindow.postMessage(payload, this.origin)

                continue
            }
            
            instance.target.postMessage(payload, this.origin)
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

        const instance = this.#createInstance(iframe, 'iframe')

        return instance
    }

    launchTab () {
        const tab = window.open(this.url)

        const instance = this.#createInstance(tab, 'tab')

        return instance
    }
}
