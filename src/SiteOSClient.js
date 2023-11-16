class SiteOSClient {
    constructor () {
        this.listeners = {}

        this.referrer = null

        this.init()
    }

    init () {
        this.setReferrer()

        window.addEventListener('message', event => this.onMessage(event))
    }

    onMessage (event) {
        const referrerOrigin = new URL(this.referrer).origin

        if (event.origin !== referrerOrigin) return

        const { name, args } = event.data

        const listener = this.listeners[name]

        if (!listener) {
            return
        }

        listener(...args)
    }

    setReferrer () {
        if (document.referrer) {
            sessionStorage.setItem('referrer', document.referrer)
        }

        const referrer = sessionStorage.getItem('referrer')

        if (referrer) {
            this.referrer = referrer
        }
    }

    postMessage (data) {
        if (window.opener) {
            window.opener.postMessage(data, this.referrer)

            return
        }


        window.parent.postMessage(data, this.referrer)
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

        this.postMessage(payload)
    }
}
