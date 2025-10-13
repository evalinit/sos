export class SiteOSController {
    constructor (url, options = {}) {
        this.options = options

        this.listeners = {}

        this.promises = {}

        this.instances = []

        this.hiddenContainerID = 'site-os-hidden-container'

        this.#setURL(url)

        this.#setOrigins()

        this.#init()
    }





    #setURL (url) {
        if (url.startsWith('/')) {
            url = `${ location.origin }${ url }`
        }

        this.url = url
    }





    #setOrigins () {
        const baseOrigin = new URL(this.url).origin

        const allowedOrigins = this.options.allowedOrigins ?? []

        this.origins = new Set([ baseOrigin, ...allowedOrigins ])
    }





    #init () {
        window.addEventListener('message', (event) => this.#onMessage(event))

        this.#createHiddenContainer()
    }





    #onMessage (event) {
        let matchedInstance

        for (const instance of this.instances) {
            const matchedFrame = instance.type === 'iframe' && (instance.target.contentWindow === event.source)

            const matchedTab = instance.type === 'tab' && (instance.target === event.source)

            if (!matchedFrame && !matchedTab) continue

            matchedInstance = instance

            break
        }

        const matchedOrigin = this.origins.has(event.origin)

        if (!matchedOrigin || !matchedInstance) {
            return
        }

        const { name, args = [], promiseID } = event.data

        if (promiseID) {
            this.#resolveRequest(promiseID, args)

            return
        }

        const listener = this.listeners[name]

        listener?.(...args, matchedInstance)

        const instanceListener = matchedInstance.listeners[name]

        instanceListener?.(...args)
    }





    #resolveRequest (promiseID, args) {
        const resolve = this.promises[promiseID]

        if (!resolve) {
            return
        }

        resolve(...args)

        delete this.promises[promiseID]
    }





    #createHiddenContainer () {
        const hiddenContainer = document.getElementById(this.hiddenContainerID)

        if (hiddenContainer) {
            return
        }

        const div = document.createElement('div')

        div.id = this.hiddenContainerID

        div.style.display = 'none'

        document.body.appendChild(div)
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





    #postToAllOrigins (target, payload) {
        for (const origin of this.origins) {
            target.postMessage(payload, origin)
        }
    }





    #createInstance (target, type, props) {
        props = props || {}

        const proxy = this.#createProxy(props)
        
        const instance = {
            target,
            type,
            props: proxy,
            outerThis: this
        }

        instance.listeners = {}

        instance.listeners.SiteOSProps = function () {
            this.emit('SiteOSProps', { ...this.props })
        }.bind(instance)

        instance.listeners.SiteOSPropsUpdated = function (props) {
            this.props = this.outerThis.#createProxy(props)

            this.propsUpdated?.(props)
        }.bind(instance)

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
                this.outerThis.#postToAllOrigins(this.target.contentWindow, payload)

                return
            }

            this.outerThis.#postToAllOrigins(this.target, payload)
        }

        instance.toFrame = async function (containerOrId) {
            if (this.type === 'iframe') {
                return
            }

            const promise = new Promise(resolve => {
                const frame = this.outerThis.#createFrame()

                frame.onload = () => {
                    resolve()
                }

                this.type = 'iframe'

                this.target.close()

                this.target = frame

                const container = this.outerThis.#getContainer(containerOrId)

                container.appendChild(frame)
            })

            return promise
        }

        instance.toTab = async function () {
            if (this.type === 'tab') {
                return
            }

            const promise = new Promise(resolve => {
                this.on('SiteOSClientLoaded', () => {
                    this.off('SiteOSClientLoaded')

                    resolve()
                })

                this.type = 'tab'

                this.target.remove()

                this.target = window.open(this.outerThis.url)
            })

            return promise
        }

        instance.request = async function (name, ...args) {
            const id = crypto.randomUUID()

            const promise = new Promise(resolve => {
                this.outerThis.promises[id] = resolve
            })
    
            args.push(id)
    
            this.emit(name, ...args)
    
            return promise
        }

        instance.resolve = function (promiseID, ...args) {
            const payload = {
                promiseID,
                args
            }

            if (this.type === 'iframe') {
                this.outerThis.#postToAllOrigins(this.target.contentWindow, payload)

                return
            }

            this.outerThis.#postToAllOrigins(this.target, payload)
        }

        instance.destroy = () => {
            let matchedIndex

            for (const [index, obj] of this.instances.entries()) {
                if (obj !== instance) {
                    continue
                }

                matchedIndex = index

                break
            }

            instance.target.remove()

            this.instances.splice(matchedIndex, 1)
        }

        this.instances.push(instance)

        return instance
    }





    #createFrame () {
        const iframe = document.createElement('iframe')

        iframe.src = this.url
        iframe.allow = 'geolocation; microphone; camera; display-capture;'
        iframe.sandbox = 'allow-modals allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation allow-downloads'
        iframe.allowfullscreen = ''
        iframe.allowpaymentrequest = ''
        iframe.frameborder = '0'
        iframe.style.width = '100%'
        iframe.style.height = '100%'

        return iframe
    }





    #getContainer (containerOrId) {
        let container

        if (containerOrId) {
            if (typeof containerOrId === 'string') {
                container = document.getElementById(containerOrId)
            } else {
                container = containerOrId
            }
        }

        if (!container) {
            container = document.getElementById(this.hiddenContainerID)
        }

        return container
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
                this.#postToAllOrigins(instance.target.contentWindow, payload)


                continue
            }
            
            this.#postToAllOrigins(instance.target, payload)
        }
    }





    async request (name, ...args) {
        const id = crypto.randomUUID()

        const promise = new Promise(resolve => {
            this.promises[id] = resolve
        })

        args.push(id)

        this.emit(name, ...args)

        return promise
    }





    resolve (promiseID, ...args) {
        const payload = {
            promiseID,
            args
        }

        for (const instance of this.instances) {
            if (instance.type === 'iframe') {
                this.#postToAllOrigins(instance.target.contentWindow, payload)

                continue
            }
            
            this.#postToAllOrigins(instance.target, payload)
        }
    }

    



    async launch (containerOrId, props) {
        const promise = new Promise(resolve => {
            const iframe = this.#createFrame()

            const instance = this.#createInstance(iframe, 'iframe', props)

            iframe.addEventListener('load', () => {
                instance.emit('SiteOSControllerOrigin', location.origin)

                resolve(instance)
            })

            const container = this.#getContainer(containerOrId)

            container.appendChild(iframe)
        })

        return promise
    }




    
    launchTab (props) {
        const tab = window.open(this.url)

        const instance = this.#createInstance(tab, 'tab', props)

        return instance
    }
}
