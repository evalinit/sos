export class SiteOSController {
    constructor (url) {
        this.#setURL(url)

        this.origin = new URL(this.url).origin

        this.listeners = {}

        this.promises = {}

        this.instances = []

        this.hiddenContainerID = 'site-os-hidden-container'

        this.#init()
    }





    #setURL (url) {
        if (url.startsWith('/')) {
            url = `${ location.origin }${ url }`
        }

        this.url = url
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

        if (event.origin !== this.origin || !matchedInstance) {
            return
        }

        const { name, args, promiseID } = event.data

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





    #createInstance (target, type) {
        const instance = {
            target,
            type,
            origin: this.origin,
            url: this.url,
            outerThis: this
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

                this.target = window.open(this.url)
            })

            return promise
        }

        instance.resolve = function (promiseID, ...args) {
            const payload = {
                promiseID,
                args
            }

            if (this.type === 'iframe') {
                this.target.contentWindow.postMessage(payload, this.origin)

                return
            }

            this.target.postMessage(payload, this.origin)
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





    #createFrame (props) {
        const iframe = document.createElement('iframe')

        const url = new URL(this.url)

        if (props) {
            for (const [ key, value ] of Object.entries(props)) {
                url.searchParams.set(key, value)
            }
        }

        iframe.src = url.href
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
                instance.target.contentWindow.postMessage(payload, this.origin)

                continue
            }
            
            instance.target.postMessage(payload, this.origin)
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
                instance.target.contentWindow.postMessage(payload, this.origin)

                continue
            }
            
            instance.target.postMessage(payload, this.origin)
        }
    }

    



    async launch (containerOrId, props) {
        const promise = new Promise(resolve => {
            const iframe = this.#createFrame(props)

            const instance = this.#createInstance(iframe, 'iframe')

            iframe.addEventListener('load', () => {
                resolve(instance)
            })

            const container = this.#getContainer(containerOrId)

            container.appendChild(iframe)
        })

        return promise
    }




    
    launchTab () {
        const tab = window.open(this.url)

        const instance = this.#createInstance(tab, 'tab')

        return instance
    }
}
