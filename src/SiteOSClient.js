export class SiteOSClient {
    constructor () {
        this.listeners = {}

        this.promises = {}

        this.#init()
    }





    #init () {
        window.addEventListener('message', event => this.#onMessage(event))

        window.addEventListener('load', () => this.#onLoad())

        this.#attachLocationChangeEvents()

        this.#requestProps()
    }





    #onMessage (event) {
        const controllerLocation = window.opener ? window.opener.location : window.parent.location

        if (event.source.location !== controllerLocation) {
            return
        }

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





    #onLoad () {
        const payload = {
            name: 'SiteOSClientLoaded',
            args: []
        }

        this.#postMessage(payload)
    }





    #attachLocationChangeEvents () {
        const { pushState, replaceState } = history

        history.pushState = function () {
            const value = pushState.apply(this, arguments)

            const event = new Event('locationchange')

            window.dispatchEvent(event)

            return value
        }

        history.replaceState = function () {
            const value = replaceState.apply(this, arguments)

            const event = new Event('locationchange')

            window.dispatchEvent(event)

            return value
        }

        window.addEventListener('popstate', () => {
            const event = new Event('locationchange')

            window.dispatchEvent(event)
        })

        window.addEventListener('locationchange', () => {
            const message = {
                name:'SiteOSClientLocationChanged',
                args: [ location.href ]
            }

            this.#postMessage(message)
        })
    }





    #createProxy (props) {
        const handler = {
            set: (obj, key, value) => {
                obj[key] = value

                this.emit('SiteOSPropsUpdated', obj)

                return true
            },
            deleteProperty: (obj, key) => {
                delete obj[key]

                this.emit('SiteOSPropsUpdated', obj)

                return true
            }
        }

        return new Proxy(props, handler)
    }





    #requestProps () {
        this.propsPromise = new Promise(resolve => {
            this.propsResolve = resolve
        })

        this.listeners.SiteOSProps = (props) => {
            this.props = this.#createProxy(props)

            this.propsResolve(props)

            this.propsPromise = null
        }

        this.listeners.SiteOSPropsUpdated = (props) => {
            this.props = this.#createProxy(props)

            this.propsUpdated?.(props)
        }

        const payload = {
            name: 'SiteOSProps'
        }

        this.#postMessage(payload)
    }





    #postMessage (data) {
        if (window.opener) {
            window.opener.postMessage(data, '*') // todo: parent origin

            return
        }


        window.parent.postMessage(data, '*') // todo: parent origin
    }





    #resolveRequest (promiseID, args) {
        const resolve = this.promises[promiseID]

        if (!resolve) {
            return
        }

        resolve(...args)

        delete this.promises[promiseID]
    }





    async propsReady () {
        return this.propsPromise ? this.propsPromise : this.props
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





    resolve (promiseID, ...args) {
        const payload = {
            promiseID,
            args
        }

        this.#postMessage(payload)
    }
}