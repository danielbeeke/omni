import { throttle } from './throttle.js'
import { getChain } from './getChain.js'
import { render, html } from './async'
import { lazyThenable } from 'ldflex';
import { toIterablePromise } from 'ldflex'

const state = new Map()
const defaultRender = () => window.dispatchEvent(new CustomEvent('draw'))
const throttledDefaultRender = throttle(defaultRender, 100)

const rewriteProxy = (pathData, context) => {
  return new Proxy({}, {
    get (target, prop, receiver) {
      const expandedProp = context.expandTerm(prop)

      /**
       * If the result has been cached by the preload.
       */
      if (pathData.cache?.property?.[expandedProp]) {
        return {

          [Symbol.asyncIterator]: async function * () {
            for (const item of pathData.cache.property[expandedProp]) {
              yield item
            }
          },

          proxy: true,

          toString () {
            return pathData.cache.property[expandedProp][0].value
          },

          async unfold (callback) {
            const mapping = {}

            const prefix = `<${expandedProp}>/`

            for (const key of Object.keys(pathData.cache.property)) {
              if (key.startsWith(prefix)) {
                let cleanedProp = key.replace(prefix, '')
                cleanedProp = cleanedProp.replace(/\<|\>/g, '')
                mapping[cleanedProp] = pathData.cache.property[key]
              }
            }

            let finalExpandedProp
            callback(new Proxy({}, {
              get (target, prop, receiver) {
                // TODO only works for one call to the object.
                finalExpandedProp = context.expandTerm(prop)
              }
            }))

            const output = mapping[finalExpandedProp].map(item => callback(rewriteProxy(item, context)))
            
            return await Promise.all(output)
          },
        }
      }

      /**
       * If the subject has been gathered by the preload.
       */
      if (pathData.subject) {
        return {
          proxy: true,
          toString () {
            return pathData.toString()
          }
        }
      }

      console.log(prop)
    }
  })
}

export const progressively = (context) => ({
  handle: (pathData, path) => {
    return function (callback) {
      const cid = pathData.parent?.subject?.value + ':' + callback.toString()

      let items = state.get(cid)

      if (items === undefined) {
        items = []
        state.set(cid, items)

        /**
         * This is an independant thread. 
         * This enables 'unfolding'
         */
        ;(async () => {

          const chain = getChain(callback)
          if (chain.length) await path.preload(...chain)

          for (const item of pathData.resultsCache) {
            const itemResult = await callback(rewriteProxy(item, context))
            items.push(itemResult)
            state.set(cid, items)
            throttledDefaultRender()
          }  
  
        })()
      }

      return items
    }
  }
})



