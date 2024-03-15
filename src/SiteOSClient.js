export class SiteOSClient {
    constructor (options) {
        this.options = options

        this.listeners = {}

        this.promises = {}

        this.referrer = null

        this.#init()
    }

    #init () {
        this.#setLocation()

        this.#setReferrer()

        if (this.options?.trackLocation) {
            this.#attachLocationChangeEvents()

            const originalLocation = sessionStorage.getItem('location')

            if (location.href !== originalLocation) {
                this.#postMessage({
                    name: 'SiteOSClientLocationChanged',
                    args: [location.href]
                })
            }
        }

        window.addEventListener('message', event => this.#onMessage(event))
    }

    #setLocation () {
        const existingValue = sessionStorage.getItem('location')

        if (existingValue) return

        sessionStorage.setItem('location', location.href)
    }

    #setReferrer () {
        const existingValue = sessionStorage.getItem('referrer')

        if (document.referrer && !existingValue) {
            sessionStorage.setItem('referrer', document.referrer)
        }

        const referrer = sessionStorage.getItem('referrer')

        if (referrer) {
            this.referrer = referrer
        }
    }

    #attachLocationChangeEvents () {
        const { pushState, replaceState } = history

        history.pushState = function () {
            const value = pushState.apply(this, arguments)

            window.dispatchEvent(new Event('locationchange'))

            return value
        }

        history.replaceState = function () {
            const value = replaceState.apply(this, arguments)

            window.dispatchEvent(new Event('locationchange'))

            return value
        }

        window.addEventListener('popstate', () => {
            window.dispatchEvent(new Event('locationchange'))
        })

        window.addEventListener('locationchange', () => {
            this.#postMessage({
                name: 'SiteOSClientLocationChanged',
                args: [location.href]
            })
        })
    }

    #onMessage (event) {
        const referrerOrigin = new URL(this.referrer).origin

        if (event.origin !== referrerOrigin) return

        const { name, args, promiseID } = event.data

        if (promiseID) {
            this.#resolveRequest(promiseID, args)

            return
        }

        const listener = this.listeners[name]

        if (!listener) {
            return
        }

        listener(...args)
    }

    #postMessage (data) {
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

        this.#postMessage(payload)
    }

    request (name, ...args) {
        const id = crypto.randomUUID()

        const promise = new Promise(resolve => {
            this.promises[id] = resolve
        })

        args.push(id)

        const payload = {
            name,
            args
        }

        this.#postMessage(payload)

        return promise
    }

    #resolveRequest (promiseID, args) {
        const resolve = this.promises[promiseID]

        if (!resolve) {
            return
        }

        resolve(...args)

        delete this.promises[promiseID]
    }
}
