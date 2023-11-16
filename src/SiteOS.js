class SiteOS {
    constructor (apps) {
        this.apps = apps

        this.instances = {}

        this.allowedOrigins = new Set()

        this.init()
    }

    init () {
        window.addEventListener('message', event => this.onMessage(event))

        for (const [ appName, appData ] of Object.entries(this.apps)) {
            this.registerApp(appName, appData)

            this.attachFrame(appName, appData)

            const url = new URL(appData.url)

            this.allowedOrigins.add(url.origin)
        }
    }

    onMessage (event) {
        const originAllowed = this.allowedOrigins.has(event.origin)

        if (!originAllowed) return

        const { name, args } = event.data

        for (const [ appName, instance ] of Object.entries(this.instances)) {
            const { frames, tabs } = instance

            for (const [ instanceId, frame ] of Object.entries(frames)) {
                if (frame.contentWindow !== event.source) continue

                const listener = this[appName].listeners[name]

                if (listener) {
                    listener(...args, instanceId)
                }

                return
            }

            // loop over tabs
        }
    }

    registerApp (appName, appData) {
        appData.outerThis = this

        appData.name = appName

        appData.listeners = {}

        appData.on = function (name, cb) {
            this.listeners[name] = cb
        }

        appData.off = function (name) {
            delete this.listeners[name]
        }

        appData.emit = function (name, ...args) {
            // check for instance id if they pass it in somewhere

            const { frames, tabs } = this.outerThis.instances[this.name]

            const payload = {
                name,
                args
            }

            for (const [ instanceId, frame ] of Object.entries(frames)) {
                frame.contentWindow.postMessage(payload, this.url)
            }

            // loop over tabs as well
        }

        this[appName] = appData

        this.instances[appName] = {
            frames: {},
            tabs: {},
            count: 1
        }
    }

    attachFrame (appName, appData) {
        const frame = document.createElement('iframe')

        frame.src = appData.url

        document.body.appendChild(frame)

        const instance = this.instances[appName]

        instance.frames[instance.count] = frame

        instance.count += 1
    }
}
