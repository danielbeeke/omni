import { throttle } from './throttle.js'
const state = new Map()
const throttledRenders = new Map()
const defaultRender = () => {
  window.dispatchEvent(new CustomEvent('draw'))
}

export const progressively = {
  handle: (pathData, path) => {
    return (callback) => {
      let items = state.get(callback.toString())

      if (items === undefined) {
        throttledRenders.set(callback.toString(), throttle(defaultRender, 100))
        items = []
        state.set(callback.toString(), items)

        ;(async () => {
          for await (const item of path) {
            const itemResult = await callback(item)
            items.push(itemResult)
            state.set(callback.toString(), items)
            throttledRenders.get(callback.toString())()
          }
        })()

      }

      return items
    }
  }
}



